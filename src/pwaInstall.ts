// Capture the PWA install prompt globally so it's available when the user visits Settings

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredInstallPrompt = e as BeforeInstallPromptEvent
})

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredInstallPrompt
}

export function clearInstallPrompt() {
  deferredInstallPrompt = null
}
