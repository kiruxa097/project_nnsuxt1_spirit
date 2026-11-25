from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('ANALYST', 'RISK_MANAGER', 'ADMIN', 'SCHEDULER')",
            name="ck_users_role",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Process(Base):
    __tablename__ = "processes"
    __table_args__ = (
        CheckConstraint(
            "duplicate_policy IN ('REJECT', 'QUEUE', 'ALLOW_VERSIONED')",
            name="ck_processes_duplicate_policy",
        ),
        CheckConstraint("default_priority BETWEEN 1 AND 5", name="ck_processes_priority"),
        CheckConstraint("timeout_sec > 0", name="ck_processes_timeout"),
        CheckConstraint("max_parallelism > 0", name="ck_processes_parallelism"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    launch_params_schema: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    read_resources: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    write_resources: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    dependencies: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    duplicate_policy: Mapped[str] = mapped_column(String(32), nullable=False, default="QUEUE")
    default_priority: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=3)
    timeout_sec: Mapped[int] = mapped_column(Integer, nullable=False, default=300)
    max_parallelism: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    snapshot_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Resource(Base):
    __tablename__ = "resources"
    __table_args__ = (
        CheckConstraint(
            "partition_type IN ('NONE', 'DATE', 'PERIOD', 'APPLICATION_ID', 'CLIENT_LIST')",
            name="ck_resources_partition_type",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    partition_type: Mapped[str] = mapped_column(String(32), nullable=False, default="NONE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(
            "status IN ('CREATED', 'QUEUED', 'RUNNING', 'BLOCKED', 'COMPLETED', 'FAILED', 'REJECTED', 'CANCELLED', 'TIMEOUT')",
            name="ck_tasks_status",
        ),
        CheckConstraint("priority BETWEEN 1 AND 5", name="ck_tasks_priority"),
        CheckConstraint("result_version >= 1", name="ck_tasks_result_version"),
        Index("idx_tasks_status_priority", "status", "priority", "created_at"),
        Index("idx_tasks_idempotency_key", "idempotency_key"),
        Index("idx_tasks_process_status", "process_id", "status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    process_id: Mapped[str] = mapped_column(String(32), ForeignKey("processes.id"), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    params: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="CREATED")
    priority: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=3)
    result_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    initiated_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id"))
    blocked_by_task_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("tasks.id"))
    decision_reason: Mapped[str | None] = mapped_column(Text)
    queued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TaskResource(Base):
    __tablename__ = "task_resources"
    __table_args__ = (
        CheckConstraint("access_mode IN ('READ', 'WRITE')", name="ck_task_resources_mode"),
        UniqueConstraint("task_id", "resource_id", "access_mode", "partition_key", name="uq_task_resources"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    resource_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("resources.id"), nullable=False)
    access_mode: Mapped[str] = mapped_column(String(16), nullable=False)
    partition_key: Mapped[str] = mapped_column(String(128), nullable=False, default="DEFAULT")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Lock(Base):
    __tablename__ = "locks"
    __table_args__ = (
        CheckConstraint("lock_mode IN ('READ', 'WRITE')", name="ck_locks_mode"),
        UniqueConstraint("resource_id", "partition_key", "owner_task_id", "lock_mode", name="uq_locks"),
        Index("idx_locks_resource_partition", "resource_id", "partition_key"),
        Index("idx_locks_lease_expires", "lease_expires_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    resource_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("resources.id"), nullable=False)
    partition_key: Mapped[str] = mapped_column(String(128), nullable=False, default="DEFAULT")
    lock_mode: Mapped[str] = mapped_column(String(16), nullable=False)
    owner_task_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    lease_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_heartbeat_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    acquired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TaskDependency(Base):
    __tablename__ = "task_dependencies"
    __table_args__ = (Index("idx_task_deps_task_id", "task_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    depends_on_process_id: Mapped[str] = mapped_column(String(32), ForeignKey("processes.id"), nullable=False)
    depends_on_task_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("tasks.id", ondelete="SET NULL"))
    required_partition_key: Mapped[str] = mapped_column(String(128), nullable=False)
    required_status: Mapped[str] = mapped_column(String(32), nullable=False, default="COMPLETED")
    is_satisfied: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ExecutionLog(Base):
    __tablename__ = "execution_logs"
    __table_args__ = (
        Index("idx_exec_logs_task_id", "task_id"),
        Index("idx_exec_logs_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("tasks.id", ondelete="SET NULL"))
    process_id: Mapped[str] = mapped_column(String(32), ForeignKey("processes.id"), nullable=False)
    actor_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id"))
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    decision: Mapped[str] = mapped_column(String(64), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    params_snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Client(Base):
    __tablename__ = "clients"
    __table_args__ = (
        CheckConstraint("client_type IN ('INDIVIDUAL', 'SELF_EMPLOYED', 'SME')", name="ck_clients_type"),
        CheckConstraint("monthly_income >= 0", name="ck_clients_income"),
        CheckConstraint("data_version >= 1", name="ck_clients_version"),
        Index("idx_clients_region_type", "region", "client_type"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    birth_date: Mapped[date] = mapped_column(Date, nullable=False)
    region: Mapped[str] = mapped_column(String(100), nullable=False)
    client_type: Mapped[str] = mapped_column(String(32), nullable=False)
    monthly_income: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    data_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CreditApplication(Base):
    __tablename__ = "credit_applications"
    __table_args__ = (
        CheckConstraint("requested_amount > 0", name="ck_apps_amount"),
        CheckConstraint("term_months > 0", name="ck_apps_term"),
        CheckConstraint("interest_rate >= 0", name="ck_apps_rate"),
        CheckConstraint("status IN ('NEW', 'IN_REVIEW', 'APPROVED', 'REJECTED')", name="ck_apps_status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    application_number: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    client_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("clients.id"), nullable=False)
    requested_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    term_months: Mapped[int] = mapped_column(Integer, nullable=False)
    interest_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    application_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="NEW")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Loan(Base):
    __tablename__ = "loans"
    __table_args__ = (
        CheckConstraint("principal_amount > 0", name="ck_loans_principal"),
        CheckConstraint("remaining_debt >= 0", name="ck_loans_debt"),
        CheckConstraint("monthly_payment > 0", name="ck_loans_monthly_pmt"),
        CheckConstraint("interest_rate >= 0", name="ck_loans_rate"),
        CheckConstraint("status IN ('ACTIVE', 'CLOSED', 'OVERDUE', 'DEFAULT')", name="ck_loans_status"),
        Index("idx_loans_client_status", "client_id", "status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    contract_number: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    client_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("clients.id"), nullable=False)
    application_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("credit_applications.id"))
    principal_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    remaining_debt: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    monthly_payment: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    interest_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ACTIVE")
    payment_schedule: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint("schedule_installment_no >= 1", name="ck_payments_inst_no"),
        CheckConstraint("planned_amount > 0", name="ck_payments_planned"),
        CheckConstraint("paid_amount >= 0", name="ck_payments_paid"),
        CheckConstraint("status IN ('PENDING', 'PAID', 'PARTIAL', 'OVERDUE')", name="ck_payments_status"),
        Index("idx_payments_loan_due_date", "loan_id", "due_date"),
        Index("idx_payments_status_due_date", "status", "due_date"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    loan_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("loans.id"), nullable=False)
    schedule_installment_no: Mapped[int] = mapped_column(Integer, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    paid_date: Mapped[date | None] = mapped_column(Date)
    planned_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="PENDING")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RiskResult(Base):
    __tablename__ = "risk_results"
    __table_args__ = (
        CheckConstraint(
            "result_type IN ('APPLICATION_CHECK', 'OVERDUE_MONITORING', 'PORTFOLIO_REPORT')",
            name="ck_risk_results_type",
        ),
        CheckConstraint("version >= 1", name="ck_risk_results_version"),
        CheckConstraint("overdue_days >= 0", name="ck_risk_results_overdue_days"),
        CheckConstraint("overdue_amount >= 0", name="ck_risk_results_overdue_amount"),
        Index("idx_risk_results_type_date", "result_type", "report_date"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    result_type: Mapped[str] = mapped_column(String(32), nullable=False)
    task_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("tasks.id", ondelete="SET NULL"))
    application_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("credit_applications.id"))
    client_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("clients.id"))
    loan_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("loans.id"))
    report_date: Mapped[date | None] = mapped_column(Date)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    solvency_score: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))
    overdue_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    overdue_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
