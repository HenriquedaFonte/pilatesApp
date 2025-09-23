const Logo = ({ className = "h-8 w-8" }) => {
  return (
    <img 
      src="/logo.jpg" 
      alt="Pilates Studio Logo" 
      className={className}
      style={{ objectFit: 'contain' }}
    />
  )
}

export default Logo

