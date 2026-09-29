import { people } from '../mocks/people'
import { directorates } from '../mocks/directorates'
import { newsletters } from '../mocks/newsletters'
import type { Newsletter } from '../types'

// These functions are the only source used by the UI; they can later be replaced by data services.
export const getPeople = () => people
export const getDirectors = () => people.filter(person => person.isDirector)
export const getPerson = (id: string) => people.find(person => person.id === id)
export const getDirectorates = () => directorates
export const getDirectorate = (id: string) => directorates.find(item => item.id === id)
export const getNewsletters = (): Newsletter[] => newsletters
export const getNewsletter = (id: string) => newsletters.find(item => item.id === id)
export const currentPersonId = 'p1'
