export type NavItem = {
    to: string
    label: string
    end?: boolean
}

export type NavGroup = {
    title: string
    items: NavItem[]
}

export const navGroups: NavGroup[] = [
    {
        title: 'Бизнес-процессы', // Фронт 1
        items: [
            { to: '/', label: 'Главная', end: true },
            { to: '/processes', label: 'Процессы' },
            { to: '/results', label: 'Результаты' },
        ],
    },
    {
        title: 'Оркестратор', // Фронт 2
        items: [
            // Фронт 2 добавляет сюда свои страницы, например:
            // { to: '/queue', label: 'Очередь задач' },
        ],
    },
]