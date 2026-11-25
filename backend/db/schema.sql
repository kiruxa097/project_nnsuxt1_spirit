BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(200) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('ANALYST', 'RISK_MANAGER', 'ADMIN', 'SCHEDULER')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS processes (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    launch_params_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_resources TEXT[] NOT NULL DEFAULT '{}',
    write_resources TEXT[] NOT NULL DEFAULT '{}',
    dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
    duplicate_policy VARCHAR(32) NOT NULL DEFAULT 'QUEUE'
        CHECK (duplicate_policy IN ('REJECT', 'QUEUE', 'ALLOW_VERSIONED')),
    default_priority SMALLINT NOT NULL DEFAULT 3
        CHECK (default_priority BETWEEN 1 AND 5),
    timeout_sec INTEGER NOT NULL DEFAULT 300 CHECK (timeout_sec > 0),
    max_parallelism INTEGER NOT NULL DEFAULT 4 CHECK (max_parallelism > 0),
    snapshot_read BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resources (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    partition_type VARCHAR(32) NOT NULL DEFAULT 'NONE'
        CHECK (partition_type IN ('NONE', 'DATE', 'PERIOD', 'APPLICATION_ID', 'CLIENT_LIST')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
    id BIGSERIAL PRIMARY KEY,
    process_id VARCHAR(32) NOT NULL REFERENCES processes(id),
    idempotency_key VARCHAR(255) NOT NULL,
    params JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'CREATED'
        CHECK (status IN (
            'CREATED', 'QUEUED', 'RUNNING', 'BLOCKED',
            'COMPLETED', 'FAILED', 'REJECTED', 'CANCELLED', 'TIMEOUT'
        )),
    priority SMALLINT NOT NULL DEFAULT 3
        CHECK (priority BETWEEN 1 AND 5),
    result_version INTEGER NOT NULL DEFAULT 1 CHECK (result_version >= 1),
    initiated_by BIGINT REFERENCES users(id),
    blocked_by_task_id BIGINT REFERENCES tasks(id),
    decision_reason TEXT,
    queued_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON tasks (status, priority ASC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_tasks_idempotency_key ON tasks (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_tasks_process_status ON tasks (process_id, status);

CREATE TABLE IF NOT EXISTS task_resources (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    resource_id BIGINT NOT NULL REFERENCES resources(id),
    access_mode VARCHAR(16) NOT NULL CHECK (access_mode IN ('READ', 'WRITE')),
    partition_key VARCHAR(128) NOT NULL DEFAULT 'DEFAULT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, resource_id, access_mode, partition_key)
);

CREATE TABLE IF NOT EXISTS locks (
    id BIGSERIAL PRIMARY KEY,
    resource_id BIGINT NOT NULL REFERENCES resources(id),
    partition_key VARCHAR(128) NOT NULL DEFAULT 'DEFAULT',
    lock_mode VARCHAR(16) NOT NULL CHECK (lock_mode IN ('READ', 'WRITE')),
    owner_task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    lease_expires_at TIMESTAMPTZ NOT NULL,
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (resource_id, partition_key, owner_task_id, lock_mode)
);

CREATE INDEX IF NOT EXISTS idx_locks_resource_partition ON locks (resource_id, partition_key);
CREATE INDEX IF NOT EXISTS idx_locks_lease_expires ON locks (lease_expires_at);

CREATE TABLE IF NOT EXISTS task_dependencies (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_process_id VARCHAR(32) NOT NULL REFERENCES processes(id),
    depends_on_task_id BIGINT REFERENCES tasks(id) ON DELETE SET NULL,
    required_partition_key VARCHAR(128) NOT NULL,
    required_status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
    is_satisfied BOOLEAN NOT NULL DEFAULT FALSE,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_deps_task_id ON task_dependencies (task_id);

CREATE TABLE IF NOT EXISTS execution_logs (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT REFERENCES tasks(id) ON DELETE SET NULL,
    process_id VARCHAR(32) NOT NULL REFERENCES processes(id),
    actor_id BIGINT REFERENCES users(id),
    event_type VARCHAR(64) NOT NULL,
    decision VARCHAR(64) NOT NULL,
    reason TEXT,
    params_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exec_logs_task_id ON execution_logs (task_id);
CREATE INDEX IF NOT EXISTS idx_exec_logs_created_at ON execution_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS clients (
    id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(200) NOT NULL,
    birth_date DATE NOT NULL,
    region VARCHAR(100) NOT NULL,
    client_type VARCHAR(32) NOT NULL CHECK (client_type IN ('INDIVIDUAL', 'SELF_EMPLOYED', 'SME')),
    monthly_income NUMERIC(14, 2) NOT NULL CHECK (monthly_income >= 0),
    data_version INTEGER NOT NULL DEFAULT 1 CHECK (data_version >= 1),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_region_type ON clients (region, client_type);

CREATE TABLE IF NOT EXISTS credit_applications (
    id BIGSERIAL PRIMARY KEY,
    application_number VARCHAR(64) NOT NULL UNIQUE,
    client_id BIGINT NOT NULL REFERENCES clients(id),
    requested_amount NUMERIC(14, 2) NOT NULL CHECK (requested_amount > 0),
    term_months INTEGER NOT NULL CHECK (term_months > 0),
    interest_rate NUMERIC(5, 2) NOT NULL CHECK (interest_rate >= 0),
    application_date DATE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'NEW'
        CHECK (status IN ('NEW', 'IN_REVIEW', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loans (
    id BIGSERIAL PRIMARY KEY,
    contract_number VARCHAR(64) NOT NULL UNIQUE,
    client_id BIGINT NOT NULL REFERENCES clients(id),
    application_id BIGINT REFERENCES credit_applications(id),
    principal_amount NUMERIC(14, 2) NOT NULL CHECK (principal_amount > 0),
    remaining_debt NUMERIC(14, 2) NOT NULL CHECK (remaining_debt >= 0),
    monthly_payment NUMERIC(14, 2) NOT NULL CHECK (monthly_payment > 0),
    interest_rate NUMERIC(5, 2) NOT NULL CHECK (interest_rate >= 0),
    issue_date DATE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'CLOSED', 'OVERDUE', 'DEFAULT')),
    payment_schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loans_client_status ON loans (client_id, status);

CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    loan_id BIGINT NOT NULL REFERENCES loans(id),
    schedule_installment_no INTEGER NOT NULL CHECK (schedule_installment_no >= 1),
    due_date DATE NOT NULL,
    paid_date DATE,
    planned_amount NUMERIC(14, 2) NOT NULL CHECK (planned_amount > 0),
    paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PAID', 'PARTIAL', 'OVERDUE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_loan_due_date ON payments (loan_id, due_date);
CREATE INDEX IF NOT EXISTS idx_payments_status_due_date ON payments (status, due_date);

CREATE TABLE IF NOT EXISTS risk_results (
    id BIGSERIAL PRIMARY KEY,
    result_type VARCHAR(32) NOT NULL
        CHECK (result_type IN ('APPLICATION_CHECK', 'OVERDUE_MONITORING', 'PORTFOLIO_REPORT')),
    task_id BIGINT REFERENCES tasks(id) ON DELETE SET NULL,
    application_id BIGINT REFERENCES credit_applications(id),
    client_id BIGINT REFERENCES clients(id),
    loan_id BIGINT REFERENCES loans(id),
    report_date DATE,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    solvency_score NUMERIC(6, 4),
    overdue_days INTEGER DEFAULT 0 CHECK (overdue_days >= 0),
    overdue_amount NUMERIC(14, 2) DEFAULT 0 CHECK (overdue_amount >= 0),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_results_type_date ON risk_results (result_type, report_date);

COMMIT;
