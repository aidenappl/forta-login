declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: {
                        client_id: string;
                        callback: (response: { credential: string }) => void;
                    }) => void;
                    prompt: () => void;
                    renderButton: (
                        element: HTMLElement,
                        config: { theme: string; size: string; width: number },
                    ) => void;
                };
            };
        };
    }
}

export { };
