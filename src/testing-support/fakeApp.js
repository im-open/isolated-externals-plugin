import { createElement, Fragment, useState } from 'react';
import ReactDOM from 'react-dom';
import Modal from 'react-modal';

// special imports
import React from './fakeReact';
import { createRoot } from './fakeReactDomClient';
import { renderToString } from './fakeReactDomServer';
console.log({ React, createRoot, renderToString });

export default function fake() {
  const answer = 1 + 1;
  return answer;
}

const ButtonModal = () => {
  const [modalIsOpen, setIsOpen] = useState(false);

  const onClick = () => {
    setIsOpen(true);
  };

  return createElement(
    Fragment,
    null,
    createElement('button', { onClick }, 'Open Modal'),
    createElement(
      Modal,
      { isOpen: modalIsOpen, onRequestClose: () => setIsOpen(false) },
      createElement('h2', null, 'Modal Title'),
      createElement('p', null, 'Modal Body'),
      createElement(
        'button',
        { onClick: () => setIsOpen(false) },
        'Close Modal'
      )
    )
  );
};

ReactDOM.render(createElement(ButtonModal), document.getElementById('root'));
