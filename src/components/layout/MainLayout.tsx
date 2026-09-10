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
 * MainLayout - Layout wrapper for authenticated pages
 * Includes TopBar and content area.
 * SystemSettingsProvider hace una sola petición GET /settings/public compartida por toda la app privada.
 */
import { TopBar } from './TopBar'
import { DocumentBranding } from '@/components/branding/DocumentBranding'
import { SystemSettingsProvider } from '@/context/SystemSettingsContext'
import { ModuleProvider } from '@/context/ModuleProvider'
import { ModuleAccessBoundary } from '@/routes/ModuleAccessBoundary'

export const MainLayout = () => {
    return (
        <ModuleProvider>
            <SystemSettingsProvider>
                <DocumentBranding />
                <div className='min-h-screen bg-background flex flex-col'>
                    <TopBar />
                    <main className='flex-1 overflow-auto'>
                        <ModuleAccessBoundary />
                    </main>
                </div>
            </SystemSettingsProvider>
        </ModuleProvider>
    )
}

export default MainLayout
