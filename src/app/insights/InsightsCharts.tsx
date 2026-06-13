'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts'

const COLORS = ['#8b5cf6', '#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#fb7185', '#2dd4bf', '#a78bfa']

export function YearBarChart({ data }: { data: { year: string; count: number }[] }) {
  return (
    <div style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
          <XAxis dataKey="year" stroke="#888" tickLine={false} axisLine={false} />
          <YAxis stroke="#888" tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333', borderRadius: 8 }}
          />
          <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={'#8b5cf6'} />
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
            contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333', borderRadius: 8, padding: '8px 12px' }}
            itemStyle={{ color: '#fff', fontSize: '0.9rem' }}
            formatter={(value, name) => [`${value} Performance${Number(value) > 1 ? 's' : ''}`, name]}
          />
          <Legend verticalAlign="bottom" height={48} iconType="circle" wrapperStyle={{ fontSize: '0.75rem', color: '#ccc', textTransform: 'capitalize' }}/>
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
