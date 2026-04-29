const Topbar = () => (
  <header className="topbar">
    <div className="logo">Swiftrace</div>
    <nav className="nav">
      <a href="#track">Track</a>
      <a href="#flow">Flow</a>
      <a href="#console">Console</a>
    </nav>
    <a className="btn btn-ghost" href="#console">
      Test API
    </a>
  </header>
);

export default Topbar;
