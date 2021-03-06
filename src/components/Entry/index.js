/* global process */

import React, { PureComponent, Fragment } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import { Route, Switch, Redirect, withRouter } from 'react-router-dom';

import './Entry.css';

import { Dropbox } from 'dropbox';

import { List } from 'immutable';
import _ from 'lodash';
import classNames from 'classnames';

import parseQueryString from '../../util/parse_query_string';
import { parseOrg } from '../../lib/parse_org';
import { changelogFileContents } from '../../lib/static_file_contents';

import HeaderBar from '../HeaderBar';
import Landing from '../Landing';
import FileBrowser from '../FileBrowser';
import LoadingIndicator from '../LoadingIndicator';
import OrgFile from '../OrgFile';
import Settings from '../Settings';
import KeyboardShortcutsEditor from '../KeyboardShortcutsEditor';
import CaptureTemplatesEditor from '../CaptureTemplatesEditor';

import * as dropboxActions from '../../actions/dropbox';
import * as orgActions from '../../actions/org';
import * as baseActions from '../../actions/base';

class Entry extends PureComponent {
  constructor(props) {
    super(props);

    _.bindAll(this, [
      'handleSignIn',
      'renderChangelogFile',
      'renderSampleFile',
      'renderLanding',
      'renderFileBrowser',
      'renderFile',
    ]);
  }

  componentDidMount() {
    const { lastSeenChangelogHeader, isAuthenticated } = this.props;

    const accessToken = parseQueryString(window.location.hash).access_token;
    if (accessToken) {
      this.props.dropbox.authenticate(accessToken);
      window.location.hash = '';
    }

    const changelogFile = parseOrg(changelogFileContents);
    const firstHeaderTitle = changelogFile.getIn(['headers', 0, 'titleLine', 'rawTitle']);
    if (isAuthenticated && !!lastSeenChangelogHeader && firstHeaderTitle !== lastSeenChangelogHeader) {
      this.props.base.setHasUnseenChangelog(true);
    }
    this.props.base.setLastSeenChangelogHeader(firstHeaderTitle);
  }

  handleSignIn() {
    this.props.history.push('/');

    const dropbox = new Dropbox({ clientId: process.env.REACT_APP_DROPBOX_CLIENT_ID });
    const authURL = dropbox.getAuthenticationUrl(window.location.href);
    window.location = authURL;
  }

  renderChangelogFile() {
    return (
      <OrgFile staticFile="changelog"
               shouldDisableDirtyIndicator={true}
               shouldDisableActionDrawer={true}
               shouldDisableSyncButtons={false}
               parsingErrorMessage={"The contents of changelog.org couldn't be loaded. You probably forgot to set the environment variable - see the Development section of README.org for details!"} />
    );
  }

  renderSampleFile() {
    return (
      <OrgFile staticFile="sample"
               shouldDisableDirtyIndicator={true}
               shouldDisableActionDrawer={false}
               shouldDisableSyncButtons={true}
               parsingErrorMessage={"The contents of sample.org couldn't be loaded. You probably forgot to set the environment variable - see the Development section of README.org for details!"} />
    );
  }

  renderLanding() {
    return (
      <Landing onSignInClick={this.handleSignIn} />
    );
  }

  renderFileBrowser({ match: { params: { path = '' } } }) {
    if (!!path) {
      path = '/' + path;
    }

    return <FileBrowser path={path} />;
  }

  renderFile({ match: { params: { path } } }) {
    if (!!path) {
      path = '/' + path;
    }

    return (
      <OrgFile path={path}
               shouldDisableDirtyIndicator={false}
               shouldDisableActionDrawer={false}
               shouldDisableSyncButtons={false} />
    );
  }

  render() {
    const {
      isAuthenticated,
      loadingMessage,
      fontSize,
      activeModalPage,
    } = this.props;

    const className = classNames('entry-container', {
      'entry-container--large-font': fontSize === 'Large',
    });

    return (
      <div className={className}>
        <HeaderBar onSignInClick={this.handleSignIn} />

        {!!loadingMessage && <LoadingIndicator message={loadingMessage} />}

        {activeModalPage === 'changelog' ? (
          this.renderChangelogFile()
        ) : (
          isAuthenticated ? (
            ['keyboard_shortcuts_editor', 'settings', 'capture_templates_editor'].includes(activeModalPage) ? (
              <Fragment>
                {activeModalPage === 'settings' && <Settings />}
                {activeModalPage === 'keyboard_shortcuts_editor' && <KeyboardShortcutsEditor />}
                {activeModalPage === 'capture_templates_editor' && <CaptureTemplatesEditor />}
              </Fragment>
            ) : (
              <Switch>
                <Route path="/file/:path+" render={this.renderFile} />
                <Route path="/files/:path*" render={this.renderFileBrowser} />
                <Redirect to="/files" />
              </Switch>
            )
          ) : (
            <Switch>
              <Route path="/sample" exact={true} render={this.renderSampleFile} />
              <Route path="/" exact={true} render={this.renderLanding} />
              <Redirect to="/" />
            </Switch>
          )
        )}
      </div>
    );
  }
}

const mapStateToProps = (state, props) => {
  return {
    loadingMessage: state.base.get('loadingMessage'),
    isAuthenticated: !!state.dropbox.get('accessToken'),
    fontSize: state.base.get('fontSize'),
    lastSeenChangelogHeader: state.base.get('lastSeenChangelogHeader'),
    activeModalPage: state.base.get('modalPageStack', List()).last(),
  };
};

const mapDispatchToProps = dispatch => {
  return {
    dropbox: bindActionCreators(dropboxActions, dispatch),
    org: bindActionCreators(orgActions, dispatch),
    base: bindActionCreators(baseActions, dispatch),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Entry));
