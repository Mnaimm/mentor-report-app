// components/KpiCard.js
import React from 'react';

export default function KpiCard({
  title,
  value,
  subtitle = null,
  icon = null,
  color = 'bg-white',
  onClick = null,
  loading = false
}) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`${color} rounded-lg shadow-md p-6 border border-gray-200 ${
        onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''
      }`}
      disabled={loading}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-1">
        {loading ? '...' : value}
      </div>
      {subtitle && (
        <p className="text-xs text-gray-500">{subtitle}</p>
      )}
    </Component>
  );
}
