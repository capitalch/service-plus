export async function compressImage(file: File, maxSizeKb: number): Promise<File> {
    const maxBytes = maxSizeKb * 1024;
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (!ctx) { reject(new Error("Canvas not supported")); return; }

            let scale = 1.0;
            let quality = 0.85;

            const attempt = () => {
                canvas.width  = Math.round(img.width  * scale);
                canvas.height = Math.round(img.height * scale);
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                canvas.toBlob(blob => {
                    if (!blob) { reject(new Error("Compression failed")); return; }
                    if (blob.size <= maxBytes) {
                        resolve(new File([blob], file.name, { type: blob.type, lastModified: Date.now() }));
                    } else if (quality > 0.3) {
                        quality = Math.round((quality - 0.1) * 10) / 10;
                        attempt();
                    } else if (scale > 0.3) {
                        scale   *= 0.75;
                        quality  = 0.7;
                        attempt();
                    } else {
                        // Best effort — accept whatever we have
                        resolve(new File([blob], file.name, { type: blob.type, lastModified: Date.now() }));
                    }
                }, "image/jpeg", quality);
            };

            attempt();
        };

        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
        img.src = url;
    });
}
