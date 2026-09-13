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
    Management: lazy(() => import('@/components/UserManagement')),
    Create: lazy(() => import('@/components/users/UserCreatePage')),
    Import: lazy(() => import('@/pages/UserImportPage')),
    Detail: lazy(() => import('@/components/users/UserDetailPage')),
    Roles: lazy(() => import('@/components/users/RolesPermissionsManagement')),
    RoleCreate: lazy(() => import('@/components/users/RoleCreatePage')),
    RoleDetail: lazy(() => import('@/components/users/RolePermissionsDetail')),
  },
} as const
