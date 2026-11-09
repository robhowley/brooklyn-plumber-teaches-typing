// Hand-edited pixel contours from the authorized 00:30 glove reference.
// Source/alignment evidence: artifacts/trace-hud/provenance.json.
// The engine's readable hint still owns every finger mapping.
const fingers = {
  little: 'M10 22V20H9V18H8V16H7V13H9V14H10V15H11V17H12V18H13V20H15V23Z',
  ring: 'M17 20V18H16V15H15V11H14V8H13V4H15V5H16V7H17V10H18V13H19V16H20V20Z',
  middle: 'M22 21V17H23V12H24V7H25V4H26V3H30V6H29V10H28V14H27V18H26V21Z',
  index: 'M29 23V20H30V18H31V16H33V13H35V11H37V10H40V13H39V15H37V18H35V21H34V24Z',
  thumb: 'M32 25H37V24H41V25H43V26H44V27H40V28H38V29H36V30H34V32H31Z',
};

export function gloveMarkup(hand) {
  return `<svg class="glove" data-hand="${hand}" viewBox="0 0 51 46" aria-hidden="true" focusable="false" shape-rendering="crispEdges">
    <g ${hand === 'right' ? 'transform="translate(51 0) scale(-1 1)"' : ''}>
      <path class="glove-outline" d="M11 2H15V3H17V5H18V8H19V11H20V15H21V11H22V6H23V3H24V1H31V2H32V7H31V11H30V15H32V12H34V10H36V8H41V9H42V13H41V16H39V19H37V22H42V23H44V24H46V28H45V29H41V30H39V31H37V33H35V35H33V37H32V38H33V42H31V44H25V45H19V44H15V43H12V42H10V41H8V39H7V35H8V33H9V31H8V25H7V21H6V18H5V14H6V11H10V12H12V14H13V12H12V8H11Z"/>
      <path class="glove-shade" d="M12 3H15V4H16V6H17V9H18V12H19V15H20V19H22V13H23V8H24V4H25V2H30V3H31V7H30V11H29V15H28V19H29V18H31V15H33V12H35V10H37V9H40V10H41V13H40V15H38V18H36V21H35V24H41V23H42V24H44V25H45V28H40V29H38V30H36V32H34V34H32V36H31V39H32V41H30V43H24V44H19V43H15V42H12V41H10V40H9V38H8V35H9V34H11V32H10V26H9V21H8V18H7V15H6V13H7V12H9V13H10V14H11V16H12V18H14V20H16V18H15V15H14V12H13V8H12Z"/>
      <path class="glove-palm" d="M11 20H17V19H22V20H28V21H31V23H34V26H36V28H34V31H32V33H30V36H27V38H21V37H17V36H14V34H12V31H11Z"/>
      ${Object.entries(fingers).map(([finger, d]) => `<path class="glove-finger" data-finger="${finger}" d="${d}"/>`).join('')}
      <path class="glove-cuff" d="M10 34H12V35H15V37H19V38H24V39H30V41H27V42H20V41H16V40H13V39H11V38H10Z"/>
      <path class="glove-crease" d="M15 26H17V28H18V30H17V29H16V28H15Z M21 25H23V28H22V30H21Z M27 27H29V29H27V30H26V32H25V30H26V28H27Z M11 34H13V35H15V36H18V37H22V38H27V39H25V40H20V39H17V38H14V37H12V36H11Z"/>
    </g>
  </svg>`;
}

export function updateGloves(container, hint) {
  const thumb = hint.startsWith('Either thumb');
  const [hand, finger] = hint.toLowerCase().split(' ');
  const shifted = hint.includes('opposite Shift');
  container.querySelectorAll('.glove').forEach(glove => {
    const sameHand = glove.dataset.hand === hand;
    glove.querySelectorAll('[data-finger]').forEach(part => {
      part.classList.toggle('active', thumb ? part.dataset.finger === 'thumb' : sameHand && part.dataset.finger === finger);
      part.classList.toggle('shift-finger', shifted && !sameHand && part.dataset.finger === 'little');
    });
  });
}
