/** Abre o "Compartilhar" do iPhone com o arquivo (WhatsApp Business, Arquivos, iCloud…). */
export async function compartilharArquivo(file: File): Promise<'ok' | 'cancelado' | 'baixado'> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: file.name });
      return 'ok';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelado';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'baixado';
}
