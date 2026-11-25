import argparse
import json
import os
import random
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

REGIONS = [
    "Нижегородская область",
    "Москва",
    "Санкт-Петербург",
    "Республика Татарстан",
    "Свердловская область",
    "Новосибирская область",
]

CLIENT_TYPES = ["INDIVIDUAL", "SELF_EMPLOYED", "SME"]

MALE_FIRST_NAMES = ["Артём", "Дмитрий", "Максим", "Иван", "Александр"]
MALE_LAST_NAMES = ["Смирнов", "Иванов", "Кузнецов", "Попов", "Соколов"]
MALE_PATRONYMICS = ["Александрович", "Дмитриевич", "Сергеевич", "Андреевич", "Михайлович"]

FEMALE_FIRST_NAMES = ["Анна", "Елена", "Мария", "София", "Дарья"]
FEMALE_LAST_NAMES = ["Волкова", "Морозова", "Новикова", "Фёдорова", "Орлова"]
FEMALE_PATRONYMICS = ["Александровна", "Дмитриевна", "Сергеевна", "Андреевна", "Михайловна"]


def q_money(val: float | Decimal) -> Decimal:
    return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def sql_literal(val) -> str:
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    if isinstance(val, (int, Decimal)):
        return str(val)
    if isinstance(val, (date, datetime)):
        return f"'{val.isoformat()}'"
    if isinstance(val, (dict, list)):
        raw = json.dumps(val, ensure_ascii=False).replace("'", "''")
        return f"'{raw}'::jsonb"
    if isinstance(val, tuple):
        if not val:
            return "'{}'::text[]"
        items = ", ".join(sql_literal(x) for x in val)
        return f"ARRAY[{items}]::text[]"
    escaped = str(val).replace("'", "''")
    return f"'{escaped}'"


def random_full_name(rng: random.Random) -> str:
    if rng.random() < 0.5:
        return (
            f"{rng.choice(MALE_LAST_NAMES)} "
            f"{rng.choice(MALE_FIRST_NAMES)} "
            f"{rng.choice(MALE_PATRONYMICS)}"
        )
    return (
        f"{rng.choice(FEMALE_LAST_NAMES)} "
        f"{rng.choice(FEMALE_FIRST_NAMES)} "
        f"{rng.choice(FEMALE_PATRONYMICS)}"
    )


def build_seed_statements(
    num_clients: int = 1000,
    num_loans: int = 3000,
    seed: int = 42,
) -> list[str]:
    rng = random.Random(seed)
    now = datetime(2026, 11, 25, 12, 0, 0, tzinfo=timezone.utc)
    test_dates = [
        date(2026, 11, 22),
        date(2026, 11, 23),
        date(2026, 11, 24),
        date(2026, 11, 25),
    ]

    stmts: list[str] = ["BEGIN;"]

    users_data = [
        (1, "analyst_1", "Анна Морозова", "ANALYST"),
        (2, "risk_mgr_1", "Дмитрий Волков", "RISK_MANAGER"),
        (3, "admin_1", "Кирилл Соколов", "ADMIN"),
        (4, "scheduler_svc", "Планировщик заданий", "SCHEDULER"),
    ]
    for uid, uname, fname, role in users_data:
        stmts.append(
            f"INSERT INTO users (id, username, full_name, role, created_at) VALUES "
            f"({uid}, {sql_literal(uname)}, {sql_literal(fname)}, {sql_literal(role)}, {sql_literal(now)}) "
            f"ON CONFLICT (id) DO NOTHING;"
        )

    resources_data = [
        (1, "clients_db", "Клиентская база", "CLIENT_LIST"),
        (2, "credit_registry", "Кредитный реестр", "DATE"),
        (3, "payment_schedules", "Графики платежей", "DATE"),
        (4, "payments_system", "Платёжная система", "DATE"),
        (5, "risk_results_store", "Хранилище результатов риска", "DATE"),
        (6, "portfolio_reports_store", "Хранилище отчётов портфеля", "PERIOD"),
    ]
    for rid, code, rname, ptype in resources_data:
        stmts.append(
            f"INSERT INTO resources (id, code, name, partition_type, created_at) VALUES "
            f"({rid}, {sql_literal(code)}, {sql_literal(rname)}, {sql_literal(ptype)}, {sql_literal(now)}) "
            f"ON CONFLICT (id) DO NOTHING;"
        )

    processes_data = [
        (
            "BP-01",
            "Проверка заявки на кредит",
            "Оценка клиента, кредитной истории, текущих задолженностей и платёжеспособности по заявке",
            {"required": ["application_number"], "optional": ["as_of_date"]},
            ("clients_db", "credit_registry"),
            ("risk_results_store",),
            [{"process_id": "BP-02", "mode": "FRESH_CLIENT_DATA"}],
            "ALLOW_VERSIONED",
            1,
            120,
            8,
            True,
        ),
        (
            "BP-02",
            "Обновление информации о клиентах",
            "Получение данных из внешних источников, валидация, обновление клиентской базы и версии",
            {"required": ["update_date"], "optional": ["client_ids"]},
            ("clients_db",),
            ("clients_db",),
            [],
            "QUEUE",
            3,
            300,
            2,
            False,
        ),
        (
            "BP-03",
            "Мониторинг просроченных платежей",
            "Сравнение графиков и фактических платежей за дату мониторинга, расчёт просрочек",
            {"required": ["monitoring_date"]},
            ("credit_registry", "payment_schedules", "payments_system"),
            ("risk_results_store",),
            [{"process_id": "PAYMENTS_SYNC", "mode": "ACTUAL_PAYMENTS"}],
            "REJECT",
            2,
            600,
            4,
            True,
        ),
        (
            "BP-04",
            "Формирование отчёта о кредитном портфеле",
            "Агрегация задолженности, доли просрочек и группировка по регионам и типам клиентов",
            {"required": ["report_date"]},
            ("credit_registry", "risk_results_store", "clients_db"),
            ("portfolio_reports_store",),
            [{"process_id": "BP-03", "same_date": True, "required_status": "COMPLETED"}],
            "QUEUE",
            4,
            900,
            2,
            True,
        ),
        (
            "PAYMENTS_SYNC",
            "Внешнее обновление информации о платежах",
            "Внешний процесс загрузки фактических платежей в платёжную систему (пересекается с BP-03)",
            {"required": ["sync_date"]},
            (),
            ("payments_system",),
            [],
            "QUEUE",
            2,
            300,
            1,
            False,
        ),
    ]
    for p in processes_data:
        (
            pid, pname, desc, params_schema, read_res, write_res,
            deps, dup_pol, prio, timeout_s, max_par, snap_read
        ) = p
        stmts.append(
            f"INSERT INTO processes ("
            f"id, name, description, launch_params_schema, read_resources, write_resources, "
            f"dependencies, duplicate_policy, default_priority, timeout_sec, max_parallelism, snapshot_read, created_at"
            f") VALUES ("
            f"{sql_literal(pid)}, {sql_literal(pname)}, {sql_literal(desc)}, {sql_literal(params_schema)}, "
            f"{sql_literal(read_res)}, {sql_literal(write_res)}, {sql_literal(deps)}, {sql_literal(dup_pol)}, "
            f"{prio}, {timeout_s}, {max_par}, {sql_literal(snap_read)}, {sql_literal(now)}"
            f") ON CONFLICT (id) DO UPDATE SET "
            f"name = EXCLUDED.name, description = EXCLUDED.description, "
            f"read_resources = EXCLUDED.read_resources, write_resources = EXCLUDED.write_resources, "
            f"dependencies = EXCLUDED.dependencies, default_priority = EXCLUDED.default_priority, "
            f"duplicate_policy = EXCLUDED.duplicate_policy;"
        )

    for cid in range(1, num_clients + 1):
        fname = random_full_name(rng)
        bdate = date(1965, 1, 1) + timedelta(days=rng.randint(0, 14000))
        region = rng.choice(REGIONS)
        ctype = rng.choices(CLIENT_TYPES, weights=[0.7, 0.18, 0.12], k=1)[0]
        income = q_money(rng.uniform(35000, 350000) if ctype == "INDIVIDUAL" else rng.uniform(90000, 1200000))
        dver = rng.randint(1, 5)
        upd_at = now - timedelta(hours=rng.randint(1, 240))
        stmts.append(
            f"INSERT INTO clients (id, full_name, birth_date, region, client_type, monthly_income, data_version, updated_at, created_at) "
            f"VALUES ({cid}, {sql_literal(fname)}, {sql_literal(bdate)}, {sql_literal(region)}, "
            f"{sql_literal(ctype)}, {income}, {dver}, {sql_literal(upd_at)}, {sql_literal(now)}) "
            f"ON CONFLICT (id) DO NOTHING;"
        )

    num_apps = 600
    for aid in range(1, num_apps + 1):
        client_id = rng.randint(1, num_clients)
        app_num = f"APP-2026-{aid:06d}"
        req_amt = q_money(rng.uniform(50000, 3000000))
        term_m = rng.choice([6, 12, 24, 36, 48, 60])
        rate = q_money(rng.uniform(11.5, 24.9))
        app_dt = rng.choice(test_dates) - timedelta(days=rng.randint(0, 10))
        status = rng.choices(["NEW", "IN_REVIEW", "APPROVED", "REJECTED"], weights=[0.35, 0.25, 0.25, 0.15], k=1)[0]
        stmts.append(
            f"INSERT INTO credit_applications ("
            f"id, application_number, client_id, requested_amount, term_months, interest_rate, application_date, status, created_at"
            f") VALUES ("
            f"{aid}, {sql_literal(app_num)}, {client_id}, {req_amt}, {term_m}, {rate}, "
            f"{sql_literal(app_dt)}, {sql_literal(status)}, {sql_literal(now)}"
            f") ON CONFLICT (id) DO NOTHING;"
        )

    payment_id = 1
    overdue_sample_clients = set(rng.sample(range(1, num_clients + 1), k=45))

    for lid in range(1, num_loans + 1):
        client_id = rng.randint(1, num_clients)
        app_id = lid if lid <= num_apps else None
        contract_num = f"LN-2026-{lid:06d}"
        principal = q_money(rng.uniform(100000, 4500000))
        rate = q_money(rng.uniform(10.9, 23.5))
        issue_dt = date(2025, 1, 1) + timedelta(days=rng.randint(0, 300))
        installments_count = 6

        base_installment = q_money(principal / Decimal(installments_count))
        schedule = []
        forced_overdue = client_id in overdue_sample_clients and (lid % 5 == 0)

        total_paid = Decimal("0.00")
        has_overdue = False

        for inst_no in range(1, installments_count + 1):
            due_dt = issue_dt + timedelta(days=30 * inst_no)
            planned_amt = base_installment
            schedule.append({
                "installment_no": inst_no,
                "due_date": due_dt.isoformat(),
                "amount": float(planned_amt),
            })

            if forced_overdue and inst_no in (installments_count - 1, installments_count):
                paid_amt = q_money(planned_amt * Decimal("0.4")) if inst_no == installments_count - 1 else Decimal("0.00")
                paid_dt = (due_dt + timedelta(days=2)) if paid_amt > 0 else None
                p_status = "PARTIAL" if paid_amt > 0 else "OVERDUE"
                has_overdue = True
            else:
                if due_dt <= date(2026, 11, 20):
                    paid_amt = planned_amt
                    paid_dt = due_dt - timedelta(days=rng.randint(0, 2))
                    p_status = "PAID"
                else:
                    paid_amt = Decimal("0.00")
                    paid_dt = None
                    p_status = "PENDING"

            total_paid += paid_amt
            stmts.append(
                f"INSERT INTO payments ("
                f"id, loan_id, schedule_installment_no, due_date, paid_date, planned_amount, paid_amount, status, created_at"
                f") VALUES ("
                f"{payment_id}, {lid}, {inst_no}, {sql_literal(due_dt)}, {sql_literal(paid_dt)}, "
                f"{planned_amt}, {paid_amt}, {sql_literal(p_status)}, {sql_literal(now)}"
                f") ON CONFLICT (id) DO NOTHING;"
            )
            payment_id += 1

        remaining_debt = max(Decimal("0.00"), q_money(principal - total_paid))
        loan_status = "OVERDUE" if (has_overdue and remaining_debt > 0) else ("CLOSED" if remaining_debt == 0 else "ACTIVE")
        monthly_pmt = base_installment

        stmts.append(
            f"INSERT INTO loans ("
            f"id, contract_number, client_id, application_id, principal_amount, remaining_debt, "
            f"monthly_payment, interest_rate, issue_date, status, payment_schedule, created_at"
            f") VALUES ("
            f"{lid}, {sql_literal(contract_num)}, {client_id}, {sql_literal(app_id)}, "
            f"{principal}, {remaining_debt}, {monthly_pmt}, {rate}, {sql_literal(issue_dt)}, "
            f"{sql_literal(loan_status)}, {sql_literal(schedule)}, {sql_literal(now)}"
            f") ON CONFLICT (id) DO NOTHING;"
        )

    rr_id = 1
    for dt in test_dates:
        for lid in range(1, 31):
            client_id = ((lid - 1) % num_clients) + 1
            is_bad = client_id in overdue_sample_clients
            ov_days = rng.randint(5, 45) if is_bad else 0
            ov_amt = q_money(rng.uniform(3000, 120000)) if is_bad else Decimal("0.00")
            stmts.append(
                f"INSERT INTO risk_results ("
                f"id, result_type, client_id, loan_id, report_date, version, solvency_score, overdue_days, overdue_amount, payload, created_at"
                f") VALUES ("
                f"{rr_id}, 'OVERDUE_MONITORING', {client_id}, {lid}, {sql_literal(dt)}, 1, "
                f"{q_money(rng.uniform(0.2, 0.95))}, {ov_days}, {ov_amt}, "
                f"{sql_literal({'monitoring_date': dt.isoformat(), 'flagged': is_bad})}, {sql_literal(now)}"
                f") ON CONFLICT (id) DO NOTHING;"
            )
            rr_id += 1

    for tbl in [
        "users", "resources", "tasks", "task_resources", "locks",
        "task_dependencies", "execution_logs", "clients", "credit_applications",
        "loans", "payments", "risk_results"
    ]:
        stmts.append(
            f"SELECT setval(pg_get_serial_sequence('{tbl}', 'id'), COALESCE((SELECT MAX(id) FROM {tbl}), 1), true);"
        )

    stmts.append("COMMIT;")
    return stmts


def main() -> None:
    parser = argparse.ArgumentParser(description="Генератор синтетических данных для БД проекта")
    parser.add_argument("--clients", type=int, default=1000)
    parser.add_argument("--loans", type=int, default=3000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out-sql", type=str, default=None, help="Путь для сохранения SQL-скрипта")
    parser.add_argument("--dsn", type=str, default=os.getenv("DATABASE_URL"))
    args = parser.parse_args()

    if not (2000 <= args.loans <= 5000):
        raise ValueError("Количество кредитных договоров должно быть в диапазоне 2000..5000")

    statements = build_seed_statements(
        num_clients=args.clients,
        num_loans=args.loans,
        seed=args.seed,
    )
    sql_script = "\n".join(statements) + "\n"

    if args.out_sql:
        os.makedirs(os.path.dirname(os.path.abspath(args.out_sql)), exist_ok=True)
        with open(args.out_sql, "w", encoding="utf-8") as f:
            f.write(sql_script)
        print(f"SQL сохранён в {args.out_sql} ({len(statements)} команд)")
        return

    if not args.dsn:
        print("DATABASE_URL не задан. Передай --out-sql backend/db/seed.sql или укажи --dsn.")
        return

    try:
        import psycopg
        with psycopg.connect(args.dsn) as conn:
            with conn.cursor() as cur:
                cur.execute(sql_script)
            conn.commit()
        print("Данные успешно загружены в PostgreSQL.")
    except ImportError:
        print("Пакет psycopg не установлен. Используй --out-sql для генерации SQL-файла.")


if __name__ == "__main__":
    main()
