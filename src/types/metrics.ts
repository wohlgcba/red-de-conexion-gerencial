export type MetricsGranularity = 'day' | 'week' | 'month'
export type PositionLevel = 'gerente' | 'subgerente' | 'otro'
export type ActivityKind = 'visit' | 'newsletters' | 'newsletter' | 'profile'

export interface MetricsSummary {
  members: number
  gerentes: number
  subgerentes: number
  otros: number
  withAccount: number
  entered: number
  newsletterVisitors: number
  newsletterReaders: number
  newsletterViews: number
  publishedNewsletters: number
  directoryUsers: number
  searches: number
  emptySearches: number
  profileViews: number
}

export interface GrowthBucket { starts: string; gerente: number; subgerente: number; otro: number; joined: number; left: number }
export interface ActivityBucket { starts: string; visitors: number; newsletterVisitors: number; directoryUsers: number; newsletterViews: number; searches: number; profileViews: number }
export interface NewsletterMetric { id: string; title: string; topic: string; status: string; publishedAt: string | null; readers: number; views: number; reactions: number; lastViewedAt: string | null }

export interface MetricsCoverage { syncedAt: string; managers: number; covered: number; gerentes: { total: number; covered: number }; subgerentes: { total: number; covered: number } }
export interface SearchTerm { term: string; searches: number; people: number; results?: number }
export interface ProfileMetric { id: string; name: string; role: string; ministry: string; views: number; viewers: number }

export interface MetricsOverview {
  generatedAt: string
  today: string
  granularity: MetricsGranularity
  trackingSince: string | null
  historySince: string | null
  historyUntil: string | null
  coverage: MetricsCoverage | null
  summary: MetricsSummary
  growth: GrowthBucket[]
  activity: ActivityBucket[]
  newsletters: NewsletterMetric[]
  directory: { topTerms: SearchTerm[]; emptyTerms: SearchTerm[]; topProfiles: ProfileMetric[] }
}

export interface MetricsPeopleFilters {
  query: string
  status: '' | 'never' | 'entered'
  level: '' | PositionLevel
  sort: 'name' | 'recent' | 'active' | 'joined'
  page: number
  pageSize: number
}

export interface MetricsPerson {
  id: string
  name: string
  role: string
  level: PositionLevel
  ministry: string
  directorate: string
  email: string
  joinedOn: string
  account: 'none' | 'pending_password' | 'active'
  firstActivityAt: string | null
  lastActivityAt: string | null
  activeDays: number
  newslettersRead: number
  directoryUses: number
}

export interface MetricsPeoplePage {
  total: number
  counts: { all: number; never: number; entered: number }
  rows: MetricsPerson[]
}
