import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import { getProcess } from '../api/processes'
import { launchProcess } from '../api/runs'
import LaunchResult from '../components/LaunchResult'
import PageTitle from '../components/PageTitle'
import { priorityLabels, priorityOrder } from '../labels'
import type { LaunchResponse, Priority, ProcessInfo, ProcessParam } from '../types'

type Values = Record<string, string>

function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function initialValues(process: ProcessInfo): Values {
  const values: Values = {}
  for (const param of process.params) {
    values[param.name] = param.type === 'date' ? todayIso() : ''
  }
  return values
}

function validate(params: ProcessParam[], values: Values): Values {
  const errors: Values = {}
  for (const param of params) {
    const value = (values[param.name] ?? '').trim()
    if (!value && param.required === false) continue
    if (!value) {
      errors[param.name] = 'Поле обязательно для заполнения'
    } else if (param.type === 'list') {
      const items = value.split(',').filter((item) => item.trim() !== '')
      if (items.length === 0) errors[param.name] = 'Укажите хотя бы одно значение'
    }
  }
  return errors
}

export default function LaunchPage() {
  const { processId = '' } = useParams()
  return <LaunchContent key={processId} processId={processId} />
}

function LaunchContent({ processId }: { processId: string }) {
  const [process, setProcess] = useState<ProcessInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [values, setValues] = useState<Values>({})
  const [priority, setPriority] = useState<Priority>('NORMAL')
  const [errors, setErrors] = useState<Values>({})

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<LaunchResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    getProcess(processId)
      .then((found) => {
        if (cancelled) return
        setProcess(found)
        if (found) setValues(initialValues(found))
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [processId])

  function handleChange(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!process) return

    const found = validate(process.params, values)
    setErrors(found)
    if (Object.keys(found).length > 0) return 

    setSubmitting(true)
    setSubmitError(null)
    setResult(null)
    try {
      const response = await launchProcess({ processId: process.id, params: values, priority })
      setResult(response)
    } catch (err) {
      setSubmitError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="muted">Загрузка…</p>
  if (loadError) return <div className="alert-error">Не удалось загрузить процесс: {loadError}</div>
  if (!process) {
    return (
      <>
        <PageTitle title="Процесс не найден" subtitle={`Процесса «${processId}» нет в системе`} />
        <Link to="/processes">К списку процессов</Link>
      </>
    )
  }

  return (
    <>
      <PageTitle title={`Запуск ${process.id}`} subtitle={process.name} />

      {!process.available ? (
        <div className="alert-warning">
          Этот процесс сейчас недоступен для запуска
          {process.unavailableReason ? `: ${process.unavailableReason}` : ''}
        </div>
      ) : (
        <form className="launch-form" onSubmit={handleSubmit} noValidate>
          {/* Поля строятся из параметров процесса: у каждого процесса они свои */}
          {process.params.map((param) => (
            <div key={param.name} className="field">
              <label htmlFor={param.name}>{param.label}</label>

              {param.type === 'list' ? (
                <textarea
                  id={param.name}
                  rows={3}
                  placeholder="Значения через запятую, например: 101, 102, 103"
                  value={values[param.name] ?? ''}
                  onChange={(e) => handleChange(param.name, e.target.value)}
                />
              ) : (
                <input
                  id={param.name}
                  type={param.type === 'date' ? 'date' : 'text'}
                  value={values[param.name] ?? ''}
                  onChange={(e) => handleChange(param.name, e.target.value)}
                />
              )}

              {errors[param.name] && <div className="field-error">{errors[param.name]}</div>}
            </div>
          ))}

          <div className="field">
            <label htmlFor="priority">Приоритет</label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              {priorityOrder.map((p) => (
                <option key={p} value={p}>
                  {priorityLabels[p]}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Отправка…' : 'Запустить процесс'}
          </button>
        </form>
      )}

      {submitError && <div className="alert-error result-block">Не удалось отправить запрос: {submitError}</div>}
      {result && (
        <div className="result-block">
          <LaunchResult result={result} />
        </div>
      )}
    </>
  )
}