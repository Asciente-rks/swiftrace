const FlowSection = () => (
  <section className="flow" id="flow">
    <div className="section-head">
      <h2>Role-based flow</h2>
      <p>Keep each role focused on a single job and prevent overrides.</p>
    </div>
    <div className="flow-grid">
      <article>
        <h3>Admin control</h3>
        <p>
          Create users, manage shipments, and unlock full visibility into the
          shipment lifecycle.
        </p>
        <ul>
          <li>Create customer or shipper accounts</li>
          <li>Edit any shipment details</li>
          <li>Review complete history</li>
        </ul>
      </article>
      <article>
        <h3>Shipper updates</h3>
        <p>
          Update status and location only. No accidental edits outside the
          current delivery flow.
        </p>
        <ul>
          <li>Update status and location</li>
          <li>Auto logs in history timeline</li>
          <li>Secure JWT authorization</li>
        </ul>
      </article>
      <article>
        <h3>Customer tracking</h3>
        <p>
          Place a single sample order to receive a tracking number and view the
          shipment timeline.
        </p>
        <ul>
          <li>One sample order per account</li>
          <li>Email tracking number delivery</li>
          <li>Public tracking lookup</li>
        </ul>
      </article>
    </div>
  </section>
);

export default FlowSection;
