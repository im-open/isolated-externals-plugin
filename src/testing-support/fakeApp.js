import React from 'react';
import ReactDOM from 'react-dom';
import Modal from 'react-modal';

export default function fake() {
  const answer = 1 + 1;
  return answer;
}

ReactDOM.render(React.createElement(Modal), document.getElementById('root'));
