/**
 * 브라우저에서 프로필용 이미지를 JPEG로 리사이즈(정사각 맞춤, max 변 길이).
 * @param {File} file
 * @param {{ maxEdge?: number, quality?: number }} opts
 * @returns {Promise<Blob>}
 */
export function fileToResizedJpegBlob(
  file,
  { maxEdge = 512, quality = 0.88 } = {}
) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('이미지 파일만 업로드할 수 있습니다.'));
      return;
    }
    const maxBytes = 12 * 1024 * 1024;
    if (file.size > maxBytes) {
      reject(new Error('파일이 너무 큽니다. 12MB 이하로 선택해 주세요.'));
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (!w || !h) {
          reject(new Error('이미지를 읽을 수 없습니다.'));
          return;
        }
        const scale = Math.min(1, maxEdge / Math.max(w, h));
        const tw = Math.max(1, Math.round(w * scale));
        const th = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('캔버스를 사용할 수 없습니다.'));
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, tw, th);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('이미지 변환에 실패했습니다.'));
              return;
            }
            resolve(blob);
          },
          'image/jpeg',
          quality
        );
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 불러올 수 없습니다.'));
    };
    img.src = url;
  });
}
