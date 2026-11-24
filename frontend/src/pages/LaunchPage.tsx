import { useParams } from 'react-router-dom'
import PageTitle from '../components/PageTitle'

export default function LaunchPage() {
  const { processId } = useParams()

  return (
    <>
      <PageTitle title={`Запуск ${processId ?? ''}`} subtitle="Параметры запуска" />
      <p className="muted">Здесь будет динамическая форма запуска (задача 4).</p>
    </>
  )
}