import { Line, Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const chartDefaults = {
  maintainAspectRatio: false,
  responsive: true,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: '#27272a',
      titleColor: '#fff',
      bodyColor: '#a1a1aa',
      borderColor: '#3f3f46',
      borderWidth: 1,
      padding: 12,
      displayColors: false,
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        color: '#71717a',
      },
    },
    y: {
      grid: {
        color: '#27272a',
      },
      ticks: {
        color: '#71717a',
      },
    },
  },
}

interface ActivityChartProps {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    color: string
  }[]
}

export function ActivityChart({ labels, datasets }: ActivityChartProps) {
  const data = {
    labels,
    datasets: datasets.map((ds) => ({
      label: ds.label,
      data: ds.data,
      borderColor: ds.color,
      backgroundColor: `${ds.color}20`,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 6,
      pointHoverBackgroundColor: ds.color,
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2,
    })),
  }

  return (
    <Line
      data={data}
      options={{
        ...chartDefaults,
        plugins: {
          ...chartDefaults.plugins,
          legend: {
            display: true,
            position: 'top' as const,
            align: 'end' as const,
            labels: {
              color: '#a1a1aa',
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 20,
            },
          },
        },
      }}
    />
  )
}

interface StorageChartProps {
  used: number
  total: number
}

export function StorageChart({ used, total }: StorageChartProps) {
  const available = total - used
  const percentage = (used / total) * 100

  const data = {
    labels: ['Used', 'Available'],
    datasets: [
      {
        data: [used, available],
        backgroundColor: ['#0ea5e9', '#27272a'],
        borderColor: ['#0ea5e9', '#3f3f46'],
        borderWidth: 1,
        cutout: '70%',
      },
    ],
  }

  return (
    <div className="relative">
      <Doughnut
        data={data}
        options={{
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              enabled: false,
            },
          },
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{percentage.toFixed(0)}%</p>
          <p className="text-xs text-surface-500">Used</p>
        </div>
      </div>
    </div>
  )
}

interface ProfilesChartProps {
  known: number
  unknown: number
  flagged: number
}

export function ProfilesChart({ known, unknown, flagged }: ProfilesChartProps) {
  const data = {
    labels: ['Known', 'Unknown', 'Flagged'],
    datasets: [
      {
        data: [known, unknown, flagged],
        backgroundColor: ['#10b981', '#6b7280', '#ef4444'],
        borderWidth: 0,
      },
    ],
  }

  return (
    <Bar
      data={data}
      options={{
        ...chartDefaults,
        indexAxis: 'y' as const,
        plugins: {
          ...chartDefaults.plugins,
        },
        scales: {
          ...chartDefaults.scales,
          x: {
            ...chartDefaults.scales.x,
            display: false,
          },
          y: {
            ...chartDefaults.scales.y,
            grid: {
              display: false,
            },
          },
        },
      }}
    />
  )
}
