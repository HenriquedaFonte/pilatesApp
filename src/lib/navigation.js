// "Voltar" pelo histórico; se a página foi aberta direto (sem histórico no site), vai para o fallback.
export const goBack = (navigate, fallback = '/teacher/dashboard') => {
  if ((window.history.state?.idx ?? 0) > 0) navigate(-1)
  else navigate(fallback)
}
