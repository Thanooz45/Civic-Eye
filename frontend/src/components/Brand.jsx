import React from "react";

export function Brand({ onClick, light = false }) {
  return <button className={`brand ${light ? "brand-light" : ""}`} onClick={onClick} type="button" aria-label="Civic Eye home"><span className="brand-mark">C</span><span>CIVIC<span className="brand-thin">EYE</span></span></button>;
}
