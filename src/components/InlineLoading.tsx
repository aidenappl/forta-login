export function InlineLoading({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 dark:border-neutral-600 dark:border-t-neutral-300 rounded-full animate-spin" />
      <p className="text-sm text-gray-500 dark:text-neutral-400">{message}</p>
    </div>
  );
}
