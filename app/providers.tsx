// =============================================================================
// app/providers.tsx
// Root Client Providers — montados una sola vez en app/layout.tsx.
// Orden de providers: ToastProvider > children > ToastRenderer
// =============================================================================

'use client'

import { type ReactNode }        from 'react'
import { ToastProvider,
         ToastRenderer }         from '@/lib/toast/toast'
import { OfflineBanner }         from '@/components/ui/states'
import { SkipToContent }         from '@/components/ui/accessibility'
import { useOffline }            from '@/components/ui/accessibility'
import { ThemeProvider }         from '@/lib/hooks/useTheme'

function OfflineDetector() {
  const isOffline = useOffline()
  return isOffline ? <OfflineBanner/> : null
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        {/* Accesibilidad: skip-link como primer elemento */}
        <SkipToContent/>
        {/* Banner de sin conexión */}
        <OfflineDetector/>
        {children}
        {/* Toasts al final, fuera del flujo de contenido */}
        <ToastRenderer/>
      </ToastProvider>
    </ThemeProvider>
  )
}

// =============================================================================
// INTEGRACIÓN CON LAS SERVER ACTIONS EXISTENTES
// Patch de useToast en las acciones más comunes.
// Importar en Client Components que llamen directamente a Server Actions.
// =============================================================================

// Ejemplo de uso en un botón de eliminar:
//
// 'use client'
// import { useToast } from '@/lib/toast/toast'
// import { deleteTransactionAction } from '@/app/actions/transaction.actions'
//
// export function DeleteButton({ id }: { id: string }) {
//   const { toast } = useToast()
//   const router = useRouter()
//
//   async function handleDelete() {
//     const result = await deleteTransactionAction(id)
//     if (result.ok) {
//       toast.success('Transacción eliminada')
//       router.push('/transactions')
//     } else {
//       toast.error(result.error.message, result.error.detail)
//     }
//   }
//
//   return <button onClick={handleDelete}>Eliminar</button>
// }

// =============================================================================
// ACTUALIZACIÓN: app/layout.tsx
// Añadir <Providers> envolviendo el body.
//
// export default function RootLayout({ children }) {
//   return (
//     <html ...>
//       <body ...>
//         <Providers>
//           {children}
//         </Providers>
//       </body>
//     </html>
//   )
// }
// =============================================================================
