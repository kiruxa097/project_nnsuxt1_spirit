import { NavLink, Outlet } from 'react-router-dom'
import { navGroups } from '../navigation'

export default function Layout() {
  return (
    <div className="app">
      <header className="header">
        <div className="brand">Оркестратор рисков</div>
      </header>

      <div className="body">
        <aside className="sidebar">
          {navGroups
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <nav key={group.title} className="nav-group">
                <div className="nav-group-title">{group.title}</div>
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            ))}
        </aside>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}