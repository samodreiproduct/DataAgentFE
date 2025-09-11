// src/components/ui/use-toast.jsx
// simple emitter-based hook that dispatches events consumed by Toaster
export function useToast() {
  function toast({
    title = "",
    description = "",
    duration = 3000,
    variant,
  } = {}) {
    // include variant if you wish (not used by Toaster above except availability)
    window.dispatchEvent(
      new CustomEvent("samodrei-toast", {
        detail: { title, description, duration, variant },
      })
    );
  }

  return { toast };
}
