'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts'

const COLORS = [
  'var(--accent-purple)', 'var(--state-going)', 'var(--accent-pink)', 'var(--accent-amber)',
  'var(--accent-green)', 'var(--accent-indigo)', 'var(--accent-rose)', 'var(--accent-teal)',
  'var(--accent-purple-light)',
]

export function YearBarChart({ data }: { data: { year: string; count: number }[] }) {
  return (
    <div style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-tooltip-border)" vertical={false} />
          <XAxis dataKey="year" stroke="var(--chart-axis-stroke)" tickLine={false} axisLine={false} />
          <YAxis stroke="var(--chart-axis-stroke)" tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'var(--surface-hover)' }}
            contentStyle={{ backgroundColor: 'var(--chart-tooltip-bg)', borderColor: 'var(--chart-tooltip-border)', borderRadius: 8 }}
          />
          <Bar dataKey="count" fill="var(--accent-purple)" radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill="var(--accent-purple)" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function GenrePieChart({ data }: { data: { name: string; count: number }[] }) {
  return (
    <div style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={5}
            dataKey="count"
            stroke="none"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--chart-tooltip-bg)', borderColor: 'var(--chart-tooltip-border)', borderRadius: 8, padding: '8px 12px' }}
            itemStyle={{ color: 'var(--color-white)', fontSize: '0.9rem' }}
            formatter={(value, name) => [`${value} Performance${Number(value) > 1 ? 's' : ''}`, name]}
          />
          <Legend verticalAlign="bottom" height={48} iconType="circle" wrapperStyle={{ fontSize: '0.75rem', color: 'var(--chart-axis-text)', textTransform: 'capitalize' }}/>
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
