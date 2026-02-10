import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

interface FiltersProps {
    batches: string[]
    zones: string[]
    filters: {
        batch: string
        zone: string
        program: string
        search: string
    }
    setFilter: (key: string, value: string) => void
    onExport: () => void
}

export function Filters({ batches, zones, filters, setFilter, onExport }: FiltersProps) {
    return (
        <div className="space-y-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <Input
                    placeholder="Search name, business, email..."
                    value={filters.search}
                    onChange={(e) => setFilter('search', e.target.value)}
                    className="md:w-1/3"
                />

                {/* Filters Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
                    <Select
                        value={filters.batch}
                        onChange={(e) => setFilter('batch', e.target.value)}
                    >
                        <option value="all">All Batches</option>
                        {batches.map(b => (
                            <option key={b} value={b}>{b}</option>
                        ))}
                    </Select>

                    <Select
                        value={filters.zone}
                        onChange={(e) => setFilter('zone', e.target.value)}
                    >
                        <option value="all">All Zones</option>
                        {zones.map(z => (
                            <option key={z} value={z}>{z}</option>
                        ))}
                    </Select>

                    <Select
                        value={filters.program}
                        onChange={(e) => setFilter('program', e.target.value)}
                    >
                        <option value="all">All Programs</option>
                        <option value="Bangkit">Bangkit</option>
                        <option value="Maju">Maju</option>
                    </Select>

                    <Button variant="outline" onClick={onExport} className="w-full">
                        <Download className="mr-2 h-4 w-4" /> Export
                    </Button>
                </div>
            </div>
        </div>
    )
}
