import React from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X, ZoomIn, BookOpen } from 'lucide-react'

interface BookCoverLightboxModalProps {
  isOpen: boolean
  onClose: () => void
  coverUrl?: string | null
  title: string
  author?: string
}

export const BookCoverLightboxModal: React.FC<BookCoverLightboxModalProps> = ({
  isOpen,
  onClose,
  coverUrl,
  title,
  author,
}) => {
  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] p-0 overflow-hidden bg-background/95 backdrop-blur border-border/80 shadow-2xl">
        <div className="relative flex flex-col items-center justify-center p-6 sm:p-8">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors z-10"
            aria-label="Fechar zoom"
          >
            <X className="w-5 h-5" />
          </button>

          {coverUrl ? (
            <div className="relative max-w-full flex items-center justify-center my-2">
              <img
                src={coverUrl}
                alt={`Capa do livro ${title}`}
                className="max-h-[65vh] w-auto object-contain rounded-lg shadow-xl border border-border"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="w-48 h-64 sm:w-60 sm:h-80 bg-muted/50 rounded-lg flex flex-col items-center justify-center text-muted-foreground border border-border">
              <BookOpen className="w-16 h-16 mb-2 stroke-[1.2]" />
              <p className="text-xs">Sem foto de capa disponível</p>
            </div>
          )}

          <div className="mt-4 text-center max-w-md">
            <h3 className="font-semibold text-base sm:text-lg text-foreground line-clamp-2">
              {title}
            </h3>
            {author && <p className="text-xs sm:text-sm text-muted-foreground mt-1">{author}</p>}
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button size="sm" variant="outline" onClick={onClose}>
                Fechar
              </Button>
              {coverUrl && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5"
                  onClick={() => window.open(coverUrl, '_blank')}
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  Abrir imagem original
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
