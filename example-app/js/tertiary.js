import React from 'react';
import ReactDOM from 'react-dom';

var target = document.getElementById('tertiary');
ReactDOM.render(
  <div>
    <h1>The tertiary render</h1>
    <p>These externals are not isolated.</p>
  </div>,
  target
);
