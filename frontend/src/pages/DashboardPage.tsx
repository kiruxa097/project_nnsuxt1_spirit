import PageTitle from '../components/PageTitle'

export default function DashboardPage() {
  return (
    <>
      <PageTitle title="Главная панель" subtitle="Сводка по запускам процессов" />
      <p className="muted">Здесь будут счётчики запусков (задача 2).</p>
    </>
  )
}