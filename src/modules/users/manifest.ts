import { lazy } from 'react'

export const usersModule = {
  code: 'users',
  dependencies: [] as const,
  paths: {
    list: '/usuarios',
    create: '/usuarios/nuevo',
    import: '/usuarios/importar',
    detail: '/usuarios/:id',
    roles: '/usuarios/roles-permisos',
    roleCreate: '/usuarios/roles-permisos/nuevo',
    roleDetail: '/usuarios/roles-permisos/:id',
  },
  routePrefixes: [] as const,
  pages: {
    Management: lazy(() => import('./UserManagement')),
    Create: lazy(() => import('./UserCreatePage')),
    Import: lazy(() => import('./UserImportPage')),
    Detail: lazy(() => import('./UserDetailPage')),
    Roles: lazy(() => import('./RolesPermissionsManagement')),
    RoleCreate: lazy(() => import('./RoleCreatePage')),
    RoleDetail: lazy(() => import('./RolePermissionsDetail')),
  },
} as const
