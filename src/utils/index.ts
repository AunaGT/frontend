/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

/**
 * Centralized exports for all utility functions
 */

export * from './formatters'
export * from './validators'
export * from './helpers'

/**
 * Constants used across the application
 */
export const CURRENCY_SYMBOL = 'Q'
export const LOCALE = 'es-GT'
export const DATE_FORMAT = 'dd/MM/yyyy'
export const DATETIME_FORMAT = 'dd/MM/yyyy HH:mm'
export const TIME_FORMAT = 'HH:mm'

/**
 * Status color mappings
 */
export const STATUS_COLORS = {
  Pendiente: 'yellow',
  Aprobada: 'blue',
  Rechazada: 'red',
  Completada: 'green',
  Pagado: 'green',
  Cancelada: 'red',
  'En proceso': 'blue',
} as const

/**
 * Pagination defaults
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 50,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
} as const
