import { Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '../hooks/useAuth'

export function LanguageToggle() {
  const { i18n } = useTranslation()
  const { user, supabase } = useAuth()

  const changeLanguage = async (lang) => {
    i18n.changeLanguage(lang)
    
    // Se o usuário estiver logado, salvar preferência no banco de dados para persistência
    if (user && supabase) {
      try {
        await supabase
          .from('profiles')
          .update({ preferred_language: lang })
          .eq('id', user.id)
      } catch (err) {
        console.error('Erro ao atualizar idioma do perfil:', err)
      }
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl">
          <Globe className="h-[1.2rem] w-[1.2rem] text-muted-foreground hover:text-foreground" />
          <span className="sr-only">Mudar idioma</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl">
        <DropdownMenuItem onClick={() => changeLanguage('pt')} className="cursor-pointer">
          🇧🇷 Português
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeLanguage('en')} className="cursor-pointer">
          🇺🇸 English
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeLanguage('fr')} className="cursor-pointer">
          🇫🇷 Français
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
