const Logo = ({ className = "h-9 w-9" }) => {
  return (
    <img
      src="/logo.jpg"
      alt="Josi Pilates Logo"
      className={className}
      style={{ objectFit: 'contain' }}
    />
  )
}

export default Logo
