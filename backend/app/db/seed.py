import random
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import func, select

from app.db.database import SessionLocal, init_db
from app.db.models import (
    Client,
    CreditApplication,
    Loan,
    Payment,
    Process,
    Resource,
    RiskResult,
    User,
)

REGIONS = [
    "Нижегородская область",
    "Москва",
    "Санкт-Петербург",
    "Республика Татарстан",
    "Свердловская область",
    "Новосибирская область",
]
CLIENT_TYPES = ["INDIVIDUAL", "SELF_EMPLOYED", "SME"]

MALE_FIRST = ["Артём", "Дмитрий", "Максим", "Иван", "Александр"]
MALE_LAST = ["Смирнов", "Иванов", "Кузнецов", "Попов", "Соколов"]
MALE_PATR = ["Александрович", "Дмитриевич", "Сергеевич", "Андреевич", "Михайлович"]

FEMALE_FIRST = ["Анна", "Елена", "Мария", "София", "Дарья"]
FEMALE_LAST = ["Волкова", "Морозова", "Новикова", "Фёдорова", "Орлова"]
FEMALE_PATR = ["Александровна", "Дмитриевна", "Сергеевна", "Андреевна", "Михайловна"]


def q2(val: float | Decimal) -> Decimal:
    return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def random_name(rng: random.Random) -> str:
    if rng.random() < 0.5:
        return f"{rng.choice(MALE_LAST)} {rng.choice(MALE_FIRST)} {rng.choice(MALE_PATR)}"
    return f"{rng.choice(FEMALE_LAST)} {rng.choice(FEMALE_FIRST)} {rng.choice(FEMALE_PATR)}"


def seed_registry(session) -> None:
    """Задача 3: пользователи, ресурсы и реестр процессов BP-01..BP-04 + PAYMENTS_SYNC."""
    users = [
        User(id=1, username="analyst_1", full_name="Анна Морозова", role="ANALYST"),
        User(id=2, username="risk_mgr_1", full_name="Дмитрий Волков", role="RISK_MANAGER"),
        User(id=3, username="admin_1", full_name="Кирилл Соколов", role="ADMIN"),
        User(id=4, username="scheduler_svc", full_name="Планировщик заданий", role="SCHEDULER"),
    ]
    for u in users:
        session.merge(u)

    resources = [
        Resource(id=1, code="clients_db", name="Клиентская база", partition_type="CLIENT_LIST"),
        Resource(id=2, code="credit_registry", name="Кредитный реестр", partition_type="DATE"),
        Resource(id=3, code="payment_schedules", name="Графики платежей", partition_type="DATE"),
        Resource(id=4, code="payments_system", name="Платёжная система", partition_type="DATE"),
        Resource(id=5, code="risk_results_store", name="Хранилище результатов риска", partition_type="DATE"),
        Resource(id=6, code="portfolio_reports_store", name="Хранилище отчётов портфеля", partition_type="PERIOD"),
    ]
    for r in resources:
        session.merge(r)

    processes = [
        Process(
            id="BP-01",
            name="Проверка заявки на кредит",
            description="Оценка клиента, кредитной истории, текущих задолженностей и платёжеспособности по заявке",
            launch_params_schema={"required": ["application_number"], "optional": ["as_of_date"]},
            read_resources=["clients_db", "credit_registry"],
            write_resources=["risk_results_store"],
            dependencies=[{"process_id": "BP-02", "mode": "FRESH_CLIENT_DATA"}],
            duplicate_policy="ALLOW_VERSIONED",
            default_priority=1,
            timeout_sec=120,
            max_parallelism=8,
            snapshot_read=True,
        ),
        Process(
            id="BP-02",
            name="Обновление информации о клиентах",
            description="Получение данных из внешних источников, валидация, обновление клиентской базы и версии",
            launch_params_schema={"required": ["update_date"], "optional": ["client_ids"]},
            read_resources=["clients_db"],
            write_resources=["clients_db"],
            dependencies=[],
            duplicate_policy="QUEUE",
            default_priority=3,
            timeout_sec=300,
            max_parallelism=2,
            snapshot_read=False,
        ),
        Process(
            id="BP-03",
            name="Мониторинг просроченных платежей",
            description="Сравнение графиков и фактических платежей за дату мониторинга, расчёт просрочек",
            launch_params_schema={"required": ["monitoring_date"]},
            read_resources=["credit_registry", "payment_schedules", "payments_system"],
            write_resources=["risk_results_store"],
            dependencies=[{"process_id": "PAYMENTS_SYNC", "mode": "ACTUAL_PAYMENTS"}],
            duplicate_policy="REJECT",
            default_priority=2,
            timeout_sec=600,
            max_parallelism=4,
            snapshot_read=True,
        ),
        Process(
            id="BP-04",
            name="Формирование отчёта о кредитном портфеле",
            description="Агрегация задолженности, доли просрочек и группировка по регионам и типам клиентов",
            launch_params_schema={"required": ["report_date"]},
            read_resources=["credit_registry", "risk_results_store", "clients_db"],
            write_resources=["portfolio_reports_store"],
            dependencies=[{"process_id": "BP-03", "same_date": True, "required_status": "COMPLETED"}],
            duplicate_policy="QUEUE",
            default_priority=4,
            timeout_sec=900,
            max_parallelism=2,
            snapshot_read=True,
        ),
        Process(
            id="PAYMENTS_SYNC",
            name="Внешнее обновление информации о платежах",
            description="Внешний процесс загрузки фактических платежей в платёжную систему",
            launch_params_schema={"required": ["sync_date"]},
            read_resources=[],
            write_resources=["payments_system"],
            dependencies=[],
            duplicate_policy="QUEUE",
            default_priority=2,
            timeout_sec=300,
            max_parallelism=1,
            snapshot_read=False,
        ),
    ]
    for p in processes:
        session.merge(p)
    session.flush()


def seed_synthetic_data(
    session,
    num_clients: int = 1000,
    num_loans: int = 3000,
    seed: int = 42,
) -> None:
    """Задача 2: генерация синтетических данных (1000 клиентов, 3000 кредитов, заявки, платежи, просрочки)."""
    existing_clients = session.scalar(select(func.count(Client.id)))
    if existing_clients and existing_clients >= num_clients:
        print("Синтетические данные уже загружены, пропуск.")
        return

    rng = random.Random(seed)
    now = datetime(2026, 11, 25, 12, 0, 0, tzinfo=timezone.utc)
    test_dates = [
        date(2026, 11, 22),
        date(2026, 11, 23),
        date(2026, 11, 24),
        date(2026, 11, 25),
    ]

    clients = []
    for _ in range(num_clients):
        ctype = rng.choices(CLIENT_TYPES, weights=[0.7, 0.18, 0.12], k=1)[0]
        income = q2(rng.uniform(35000, 350000) if ctype == "INDIVIDUAL" else rng.uniform(90000, 1200000))
        clients.append(
            Client(
                full_name=random_name(rng),
                birth_date=date(1965, 1, 1) + timedelta(days=rng.randint(0, 14000)),
                region=rng.choice(REGIONS),
                client_type=ctype,
                monthly_income=income,
                data_version=rng.randint(1, 5),
                updated_at=now - timedelta(hours=rng.randint(1, 240)),
                created_at=now,
            )
        )
    session.add_all(clients)
    session.flush()
    client_ids = [c.id for c in clients]

    apps = []
    for aid in range(1, 601):
        apps.append(
            CreditApplication(
                application_number=f"APP-2026-{aid:06d}",
                client_id=rng.choice(client_ids),
                requested_amount=q2(rng.uniform(50000, 3000000)),
                term_months=rng.choice([6, 12, 24, 36, 48, 60]),
                interest_rate=q2(rng.uniform(11.5, 24.9)),
                application_date=rng.choice(test_dates) - timedelta(days=rng.randint(0, 10)),
                status=rng.choices(["NEW", "IN_REVIEW", "APPROVED", "REJECTED"], weights=[0.35, 0.25, 0.25, 0.15], k=1)[0],
                created_at=now,
            )
        )
    session.add_all(apps)
    session.flush()
    app_ids = [a.id for a in apps]

    overdue_clients = set(rng.sample(client_ids, k=45))
    loans = []
    payments_buffer: list[tuple[int, list[dict]]] = []

    for idx in range(1, num_loans + 1):
        cid = rng.choice(client_ids)
        principal = q2(rng.uniform(100000, 4500000))
        installments = 6
        base_pmt = q2(principal / Decimal(installments))
        issue_dt = date(2025, 1, 1) + timedelta(days=rng.randint(0, 300))
        forced_overdue = cid in overdue_clients and (idx % 5 == 0)

        schedule = []
        pmt_rows = []
        total_paid = Decimal("0.00")
        has_overdue = False

        for inst_no in range(1, installments + 1):
            due_dt = issue_dt + timedelta(days=30 * inst_no)
            schedule.append({"installment_no": inst_no, "due_date": due_dt.isoformat(), "amount": float(base_pmt)})

            if forced_overdue and inst_no in (installments - 1, installments):
                paid_amt = q2(base_pmt * Decimal("0.4")) if inst_no == installments - 1 else Decimal("0.00")
                paid_dt = (due_dt + timedelta(days=2)) if paid_amt > 0 else None
                p_status = "PARTIAL" if paid_amt > 0 else "OVERDUE"
                has_overdue = True
            elif due_dt <= date(2026, 11, 20):
                paid_amt = base_pmt
                paid_dt = due_dt - timedelta(days=rng.randint(0, 2))
                p_status = "PAID"
            else:
                paid_amt = Decimal("0.00")
                paid_dt = None
                p_status = "PENDING"

            total_paid += paid_amt
            pmt_rows.append(
                {
                    "schedule_installment_no": inst_no,
                    "due_date": due_dt,
                    "paid_date": paid_dt,
                    "planned_amount": base_pmt,
                    "paid_amount": paid_amt,
                    "status": p_status,
                }
            )

        remaining = max(Decimal("0.00"), q2(principal - total_paid))
        l_status = "OVERDUE" if (has_overdue and remaining > 0) else ("CLOSED" if remaining == 0 else "ACTIVE")

        loan = Loan(
            contract_number=f"LN-2026-{idx:06d}",
            client_id=cid,
            application_id=app_ids[idx - 1] if idx <= len(app_ids) else None,
            principal_amount=principal,
            remaining_debt=remaining,
            monthly_payment=base_pmt,
            interest_rate=q2(rng.uniform(10.9, 23.5)),
            issue_date=issue_dt,
            status=l_status,
            payment_schedule=schedule,
            created_at=now,
        )
        loans.append(loan)
        payments_buffer.append((idx - 1, pmt_rows))

    session.add_all(loans)
    session.flush()

    payments = []
    for loan_idx, pmt_rows in payments_buffer:
        lid = loans[loan_idx].id
        for row in pmt_rows:
            payments.append(Payment(loan_id=lid, created_at=now, **row))
    session.add_all(payments)

    risk_results = []
    for dt in test_dates:
        for loan in loans[:30]:
            is_bad = loan.client_id in overdue_clients
            risk_results.append(
                RiskResult(
                    result_type="OVERDUE_MONITORING",
                    client_id=loan.client_id,
                    loan_id=loan.id,
                    report_date=dt,
                    version=1,
                    solvency_score=q2(rng.uniform(0.2, 0.95)),
                    overdue_days=rng.randint(5, 45) if is_bad else 0,
                    overdue_amount=q2(rng.uniform(3000, 120000)) if is_bad else Decimal("0.00"),
                    payload={"monitoring_date": dt.isoformat(), "flagged": is_bad},
                    created_at=now,
                )
            )
    session.add_all(risk_results)


def main() -> None:
    init_db()
    with SessionLocal() as session:
        seed_registry(session)
        seed_synthetic_data(session)
        session.commit()
    print("БД инициализирована, реестр процессов и синтетические данные загружены.")


if __name__ == "__main__":
    main()
