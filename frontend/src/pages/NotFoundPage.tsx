import { Link } from 'react-router-dom'
import PageTitle from '../components/PageTitle'

export default function NotFoundPage() {
  return (
    <>
      <PageTitle title="Страница не найдена" />
      <Link to="/">На главную</Link>
    </>
  )
}