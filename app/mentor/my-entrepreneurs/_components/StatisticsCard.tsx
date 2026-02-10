import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, BookOpen, AlertCircle, BarChart } from "lucide-react"

interface StatisticsCardProps {
    totalEntrepreneurs: number
    totalSessions: number
    avgSessions: number
    overdueCount: number
}

export function StatisticsCards({
    totalEntrepreneurs,
    totalSessions,
    avgSessions,
    overdueCount
}: StatisticsCardProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Total Entrepreneurs
                    </CardTitle>
                    <Users className="h-4 w-4 text-slate-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalEntrepreneurs}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Total Sessions
                    </CardTitle>
                    <BookOpen className="h-4 w-4 text-slate-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalSessions}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Avg. Sessions/Ent
                    </CardTitle>
                    <BarChart className="h-4 w-4 text-slate-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{avgSessions.toFixed(1)}</div>
                </CardContent>
            </Card>

            <Card className={overdueCount > 0 ? "border-red-200 bg-red-50" : ""}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className={overdueCount > 0 ? "text-red-700 font-medium text-sm" : "text-sm font-medium"}>
                        Overdue Reports
                    </CardTitle>
                    <AlertCircle className={overdueCount > 0 ? "h-4 w-4 text-red-500" : "h-4 w-4 text-slate-500"} />
                </CardHeader>
                <CardContent>
                    <div className={overdueCount > 0 ? "text-2xl font-bold text-red-700" : "text-2xl font-bold"}>
                        {overdueCount}
                    </div>
                    {overdueCount > 0 && (
                        <p className="text-xs text-red-600 mt-1">Needs attention</p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
