import React from 'react';
import { connect } from 'react-redux';
import { createSelector } from 'reselect';
import { defineMessages, FormattedMessage, injectIntl } from 'react-intl';

import style from './style.css';
import { accountActions, categoryActions, currencyActions } from '../../actions';
import AppBar from '../../components/AppBar';
import Spinner from '../../components/Spinner';

const messages = defineMessages({
  loading: {
    id: 'container.dashboard.loading',
    description: 'Loading process text',
    defaultMessage: 'Loading, please wait...',
  },
});

class Dashboard extends React.Component {
  static needs = [
    accountActions.load,
    categoryActions.load,
    currencyActions.load,
  ];

  static propTypes = {
    children: React.PropTypes.object.isRequired,
    isReady: React.PropTypes.bool.isRequired,
  }

  render() {
    const { isReady } = this.props;

    if (!isReady) {
      return (
        <div className={style['spinner-container']}>
          <Spinner />
          <h4 className="mt-1"><FormattedMessage {...messages.loading} /></h4>
        </div>
      );
    }

    return (
      <div className="pt-1">
        <div className="container"><AppBar /></div>
        <div className="container mt-1">{ this.props.children }</div>
      </div>
    );
  }
}

const isReadySelector = createSelector(
  state => state.dashboard.ready,
  ready => ready,
);

const selector = createSelector(
  isReadySelector,
  isReady => ({ isReady })
);

export default injectIntl(connect(selector)(Dashboard));
