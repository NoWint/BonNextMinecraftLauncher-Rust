declare module '@material/web/all.js' {
  const _: void;
  export default _;
}

type MdElementProps = Record<string, unknown>;

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        'md-filled-button': MdElementProps;
        'md-outlined-button': MdElementProps;
        'md-text-button': MdElementProps;
        'md-elevated-button': MdElementProps;
        'md-filled-tonal-button': MdElementProps;
        'md-fab': MdElementProps;
        'md-elevated-card': MdElementProps;
        'md-filled-card': MdElementProps;
        'md-outlined-card': MdElementProps;
        'md-dialog': MdElementProps;
        'md-filled-text-field': MdElementProps;
        'md-outlined-text-field': MdElementProps;
        'md-filled-select': MdElementProps;
        'md-outlined-select': MdElementProps;
        'md-switch': MdElementProps;
        'md-checkbox': MdElementProps;
        'md-tabs': MdElementProps;
        'md-primary-tab': MdElementProps;
        'md-secondary-tab': MdElementProps;
        'md-assist-chip': MdElementProps;
        'md-filter-chip': MdElementProps;
        'md-input-chip': MdElementProps;
        'md-suggestion-chip': MdElementProps;
        'md-badge': MdElementProps;
        'md-list': MdElementProps;
        'md-list-item': MdElementProps;
        'md-icon': MdElementProps;
        'md-divider': MdElementProps;
        'md-navigation-rail': MdElementProps;
        'md-navigation-tab': MdElementProps;
        'md-elevated-app-bar': MdElementProps;
        'md-filled-app-bar': MdElementProps;
      }
    }
  }
}

export {};
