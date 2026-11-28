# Backup criptografado — como funciona e como abrir

Todo dia, às 03:00 UTC, o GitHub faz uma cópia do banco de dados (alunos, créditos,
pagamentos, recibos, termos aceitos e fichas de saúde) e guarda essa cópia por **90 dias**
na aba **Actions** do repositório. O GitHub fica nos Estados Unidos, por isso o arquivo
sai **trancado com senha** (criptografia AES-256). Sem a senha, ninguém consegue ler o
conteúdo, nem o GitHub.

O arquivo guardado tem o nome `backup-AAAA-MM-DDTHH-MM-SS.zip.gpg`.

> **Importante:** sem a senha, o backup **não abre** — nem por você, nem por ninguém.
> Não existe "esqueci a senha". Guarde a senha num gerenciador de senhas
> (1Password, Bitwarden, o Chaves do iCloud etc.) antes de qualquer outra coisa.

Se a senha não estiver configurada no GitHub, o backup **para com erro** e nada é salvo
(nunca sai um backup sem senha). A mensagem de erro aparece na aba Actions.

---

## 1. Criar a senha (uma vez só)

1. Crie uma senha forte e longa. Sugestão: 5 ou 6 palavras aleatórias separadas por
   hífen (ex.: `cavalo-nuvem-tijolo-laranja-piano`; **não use este exemplo**). O
   gerenciador de senhas pode gerar uma para você.
   - Use **uma linha só** (sem "Enter" no meio).
2. Salve a senha no gerenciador de senhas, com o nome "Backup Josi Pilates (GitHub)".
3. No GitHub, abra o repositório `HenriquedaFonte/pilatesApp`.
4. Clique em **Settings** → no menu da esquerda, **Secrets and variables** → **Actions**.
5. Clique em **New repository secret**.
   - **Name:** `BACKUP_PASSPHRASE` (exatamente assim, em maiúsculas).
   - **Secret:** cole a senha.
6. Clique em **Add secret**.

O GitHub nunca mostra a senha de volta depois de salva: por isso ela precisa estar no
gerenciador de senhas.

---

## 2. Instalar o programa que abre o backup (uma vez só)

O programa se chama **GnuPG** (ou "gpg"). É gratuito.

- **Mac:** instale o **GPG Suite** (gpgtools.org) **ou**, se usa Homebrew, rode no
  Terminal: `brew install gnupg`.
- **Windows:** instale o **Gpg4win** (gpg4win.org). Ele traz o comando `gpg`, que
  funciona no **PowerShell** ou no **Prompt de Comando**.
- **Linux:** quase sempre já vem instalado. Se não: `sudo apt install gnupg`.

Para conferir, abra o Terminal (Mac/Linux) ou o PowerShell (Windows) e digite
`gpg --version`. Se aparecer um número de versão, está pronto.

---

## 3. Baixar o backup

1. No GitHub, abra o repositório → aba **Actions**.
2. À esquerda, clique em **🗄️ Backup Diário do Banco**.
3. Clique na execução do dia que você quer (as mais recentes ficam em cima).
4. Role até **Artifacts** e clique no nome `backup-AAAA-MM-DD...` para baixar.

O GitHub entrega um arquivo `.zip` que tem **dentro** o arquivo trancado `.zip.gpg`.
Extraia esse `.zip` baixado: no Windows, botão direito → **Extrair tudo** (dois cliques
só abrem o zip como pasta e o `gpg` não lê o arquivo de dentro); no Mac, dois cliques.
Vai aparecer o `backup-AAAA-MM-DDTHH-MM-SS.zip.gpg`. No Mac, o Safari costuma extrair
sozinho: então o `.zip.gpg` já aparece direto em Downloads e não precisa fazer nada.

---

## 4. Abrir (descriptografar) o backup

1. Abra o Terminal (Mac/Linux) ou o PowerShell (Windows) **na pasta onde está o
   arquivo `.zip.gpg`** (ex.: `cd Downloads`).
2. Rode o comando abaixo, trocando o nome do arquivo pelo seu:

   ```
   gpg -o backup.zip -d backup-2026-11-28T03-00-00.zip.gpg
   ```

   No Mac e no Linux também funciona assim: `gpg -d backup-2026-11-28T03-00-00.zip.gpg > backup.zip`.
   **No Windows use a primeira forma (`-o`)**: no PowerShell, o `>` estraga o arquivo.
3. Uma janela pede a senha: cole a senha do gerenciador de senhas.
4. Pronto: aparece o `backup.zip`, um zip normal. Dê dois cliques para abrir. Dentro tem
   uma pasta com um arquivo `.json` por tabela (ex.: `profiles.json`,
   `student_health_profiles.json`), o `manifest.json` (quantos registros cada tabela
   tem) e a pasta `storage/` (assinatura e PDFs dos recibos).

Se aparecer `decryption failed: Bad session key`, a senha está errada (ou é a senha
antiga: veja o item 5).

**Cuidado com a cópia aberta:** o `backup.zip` e a pasta extraída têm dados pessoais e
de saúde dos alunos **sem proteção**. Use só no seu computador, não mande por email nem
WhatsApp, e apague quando terminar (e esvazie a lixeira).

---

## 5. Trocar a senha

1. Crie a senha nova e salve no gerenciador de senhas **sem apagar a antiga**.
2. No GitHub: **Settings** → **Secrets and variables** → **Actions** → ao lado de
   `BACKUP_PASSPHRASE`, clique no lápis (**Update**), cole a senha nova e salve.
3. A partir do próximo backup, vale a senha nova.

Os backups **antigos continuam com a senha antiga** (eles não mudam). Guarde a senha
antiga por pelo menos **90 dias** depois da troca (é o tempo que os backups antigos
ficam no GitHub); anote no gerenciador a data da troca.

Se a senha antiga **vazou**, troque a senha e apague os backups antigos no GitHub: em
cada execução antiga, na parte **Artifacts**, clique no ícone de lixeira ao lado do
arquivo.

---

## 6. Testar (faça depois que esta mudança estiver no ar, com a senha já criada)

**Ordem:** crie o segredo `BACKUP_PASSPHRASE` **antes** de a mudança entrar no site
(senão o backup das 03:00 UTC fica vermelho). Teste **depois**: o botão "Run workflow"
roda a versão que está na `main`; antes disso ele rodaria a versão antiga, sem senha.

1. GitHub → **Actions** → **🗄️ Backup Diário do Banco** → botão **Run workflow** →
   **Run workflow**.
2. Espere a execução ficar verde (uns 2 minutos). Se ficar vermelha com a mensagem
   "O segredo BACKUP_PASSPHRASE está vazio", volte ao item 1.
3. Abra a execução: o resumo deve dizer **"Backup concluído (criptografado)"** e o
   arquivo deve terminar em `.zip.gpg`.
4. Baixe o artefato (item 3) e abra com a senha (item 4).
5. Confira que o `backup.zip` abre e tem os arquivos `.json` das tabelas.

Repita o teste de abrir um backup de vez em quando (por exemplo, a cada 3 meses): um
backup que ninguém consegue abrir não serve para nada.

---

## Detalhes técnicos (para quem mantém o sistema)

- Workflow: `.github/workflows/backup.yml`. Script de exportação: `scripts/backup.js`.
- Criptografia: `gpg --symmetric --cipher-algo AES256` (OpenPGP, CFB com MDC, sem AEAD,
  para abrir em qualquer GnuPG 2.2+), S2K iterado SHA-512. A senha entra por stdin
  (`--passphrase-fd 0`), nunca em argumento de linha de comando.
- O zip em claro e a pasta `backups/` são apagados do runner antes do upload; só o
  `.zip.gpg` vira artefato. Retenção: 90 dias.
- Sem o segredo `BACKUP_PASSPHRASE`, o workflow falha no primeiro passo, antes de
  exportar qualquer dado.
