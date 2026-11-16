export interface StreamCallbacks {
  onToken: (chunk: string) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

export async function streamAIResponse(
  endpoint: string,
  payload: Record<string, unknown>,
  idToken: string | null,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    let errMessage = `Request failed (${response.status})`;
    try {
      const json = (await response.json()) as { error?: string };
      if (json.error) errMessage = json.error;
    } catch {
      // ignore non-json error body
    }
    callbacks.onError(errMessage);
    throw new Error(errMessage);
  }

  if (!response.body) {
    const msg = 'Streaming is not supported by this browser response.';
    callbacks.onError(msg);
    throw new Error(msg);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() ?? '';

    for (const block of lines) {
      const trimmed = block.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr) continue;
      try {
        const event = JSON.parse(jsonStr) as { text?: string; error?: string; done?: boolean };
        if (event.error) {
          callbacks.onError(event.error);
          throw new Error(event.error);
        }
        if (event.text) {
          fullText += event.text;
          callbacks.onToken(event.text);
        }
        if (event.done) {
          callbacks.onDone();
        }
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
          throw parseErr;
        }
      }
    }
  }

  callbacks.onDone();
  return fullText;
}

export async function prepareImageForVision(
  file: File
): Promise<{ base64: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp'; previewUrl: string }> {
  const previewUrl = URL.createObjectURL(file);

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read the selected image file.'));
    image.src = previewUrl;
  });

  const maxDim = 1600;
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not prepare image canvas.');
  }
  ctx.drawImage(img, 0, 0, width, height);

  const outputMime: 'image/jpeg' | 'image/png' | 'image/webp' =
    file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const dataUrl = canvas.toDataURL(outputMime, 0.85);
  const base64 = dataUrl.split(',')[1] || '';

  return {
    base64,
    mimeType: outputMime,
    previewUrl,
  };
}
