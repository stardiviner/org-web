import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import { Motion, spring } from 'react-motion';
import { UnmountClosed as Collapse } from 'react-collapse';

import * as orgActions from '../../../../actions/org';

import './Header.css';

import classNames from 'classnames';
import _ from 'lodash';

import TitleLine from '../TitleLine';
import HeaderContent from '../HeaderContent';
import HeaderActionDrawer from './components/HeaderActionDrawer';

import { headerWithId } from '../../../../lib/org_utils';
import { interpolateColors, rgbaObject, rgbaString } from '../../../../lib/color';

class Header extends PureComponent {
  MIN_SWIPE_ACTIVATION_DISTANCE = 80;

  constructor(props) {
    super(props);

    _.bindAll(this, [
      'handleRef',
      'handleTouchMove',
      'handleTouchStart',
      'handleTouchEnd',
      'handleTouchCancel',
      'handleHeaderClick',
      'handleEnterTitleEditMode',
      'handleEnterDescriptionEditMode',
      'handleFocus',
      'handleUnfocus',
      'handleAddNewHeader',
    ]);

    this.state = {
      touchStartX: null,
      touchStartY: null,
      currentTouchX: null,
      containerWidth: null,
    };
  }

  componentDidMount() {
    if (this.containerDiv) {
      this.setState({ containerWidth: this.containerDiv.offsetWidth });
    }
  }

  handleRef(containerDiv) {
    this.containerDiv = containerDiv;
    this.props.onRef(containerDiv);
  }

  handleTouchStart(event) {
    if (this.props.inEditMode) {
      return;
    }

    if (!!event.target.closest('.table-part')) {
      return;
    }

    this.setState({
      touchStartX: event.changedTouches[0].clientX,
      touchStartY: event.changedTouches[0].clientY,
    });
  }

  handleTouchMove(event) {
    const { touchStartX, touchStartY } = this.state;
    if (touchStartX === null) {
      return;
    }

    const currentTouchY = event.changedTouches[0].clientY;
    if (Math.abs(currentTouchY - touchStartY) >= this.MIN_SWIPE_ACTIVATION_DISTANCE / 2) {
      this.setState({ touchStartX: null });
    } else {
      this.setState({ currentTouchX: event.changedTouches[0].clientX });
    }
  }

  handleTouchEnd(event) {
    const { touchStartX, currentTouchX } = this.state;

    if (!!touchStartX && !!currentTouchX) {
      const swipeDistance = currentTouchX - touchStartX;

      if (swipeDistance >= this.MIN_SWIPE_ACTIVATION_DISTANCE) {
        this.props.org.advanceTodoState(this.props.header.get('id'));
      }

      if (-1 * swipeDistance >= this.MIN_SWIPE_ACTIVATION_DISTANCE) {
        this.props.org.removeHeader(this.props.header.get('id'));
      }
    }

    this.setState({
      touchStartX: null,
      currentTouchX: null,
    });
  }

  handleTouchCancel() {
    this.setState({
      touchStartX: null,
      currentTouchX: null,
    });
  }

  handleHeaderClick(event) {
    const classList = event.target.classList;
    if (classList.contains('header') || classList.contains('header__bullet')) {
      const { header, hasContent, isSelected } = this.props;

      if (hasContent && (!header.get('opened') || isSelected)) {
        this.props.org.toggleHeaderOpened(header.get('id'));
      }

      this.props.org.selectHeader(header.get('id'));
    }
  }

  handleEnterTitleEditMode() {
    this.props.org.enterTitleEditMode();
  }

  handleEnterDescriptionEditMode() {
    this.props.org.openHeader(this.props.header.get('id'));
    this.props.org.enterDescriptionEditMode();
  }

  handleFocus() {
    this.props.org.focusHeader(this.props.header.get('id'));
  }

  handleUnfocus() {
    this.props.org.unfocusHeader();
  }

  handleAddNewHeader() {
    this.props.org.addHeaderAndEdit(this.props.header.get('id'));
  }

  render() {
    const {
      header,
      color,
      hasContent,
      isSelected,
      bulletStyle,
      focusedHeader,
      isFocused,
    } = this.props;

    const indentLevel = !!focusedHeader ? (
      header.get('nestingLevel') - focusedHeader.get('nestingLevel') + 1
    ) : header.get('nestingLevel');

    const { touchStartX, currentTouchX } = this.state;
    const marginLeft = (!!touchStartX && !!currentTouchX) ? (
      currentTouchX - touchStartX
    ) : (
      spring(0, { stiffness: 300 })
    );

    const style = {
      paddingLeft: 20 * indentLevel,
      marginLeft,
    };

    const className = classNames('header', {
      'header--selected': isSelected,
    });

    return (
      <Motion style={style}>
        {interpolatedStyle => {
          const swipedDistance = interpolatedStyle.marginLeft;
          const isLeftActionActivated = swipedDistance >= this.MIN_SWIPE_ACTIVATION_DISTANCE;
          const isRightActionActivated = -1 * swipedDistance >= this.MIN_SWIPE_ACTIVATION_DISTANCE;

          const disabledColor = rgbaObject(211, 211, 211, 1);
          const leftActivatedColor = rgbaObject(0, 128, 0, 1);
          const rightActivatedColor = rgbaObject(255, 0, 0, 1);

          const leftSwipeActionContainerStyle = {
            width: interpolatedStyle.marginLeft,
            backgroundColorFactor: spring(isLeftActionActivated ? 1 : 0, { stiffness: 300 }),
          };
          const rightSwipeActionContainerStyle = {
            width: -1 * interpolatedStyle.marginLeft,
            backgroundColorFactor: spring(isRightActionActivated ? 1 : 0, { stiffness: 300 }),
          };

          const leftIconStyle = {
            display: swipedDistance > 30 ? '' : 'none',
          };
          const rightIconStyle = {
            display: -1 * swipedDistance > 30 ? '' : 'none',
          };

          return (
            <div className={className}
                 style={interpolatedStyle}
                 ref={this.handleRef}
                 onClick={this.handleHeaderClick}
                 onTouchStart={this.handleTouchStart}
                 onTouchMove={this.handleTouchMove}
                 onTouchEnd={this.handleTouchEnd}
                 onTouchCancel={this.handleTouchCancel}>
              <Motion style={leftSwipeActionContainerStyle}>
                {leftInterpolatedStyle => {
                  const leftStyle = {
                    width: leftInterpolatedStyle.width,
                    backgroundColor: rgbaString(
                      interpolateColors(disabledColor,
                                        leftActivatedColor,
                                        leftInterpolatedStyle.backgroundColorFactor)
                    ),
                  };

                  return (
                    <div className="left-swipe-action-container" style={leftStyle}>
                      <i className="fas fa-check swipe-action-container__icon swipe-action-container__icon--left"
                         style={leftIconStyle} />
                    </div>
                  );
                }}
              </Motion>
              <Motion style={rightSwipeActionContainerStyle}>
                {rightInterpolatedStyle => {
                  const rightStyle = {
                    width: rightInterpolatedStyle.width,
                    backgroundColor: rgbaString(
                      interpolateColors(disabledColor,
                                        rightActivatedColor,
                                        rightInterpolatedStyle.backgroundColorFactor)
                    ),
                  };

                  return (
                    <div className="right-swipe-action-container" style={rightStyle}>
                      <i className="fas fa-times swipe-action-container__icon swipe-action-container__icon--right"
                         style={rightIconStyle} />
                    </div>
                  );
                }}
              </Motion>

              <div style={{marginLeft: -16, color}} className="header__bullet">
                {bulletStyle === 'Fancy' ? '●' : '*'}
              </div>
              <TitleLine header={header}
                         color={color}
                         hasContent={hasContent}
                         isSelected={isSelected} />

              <Collapse isOpened={isSelected} springConfig={{stiffness: 300}}>
                <HeaderActionDrawer onEnterTitleEditMode={this.handleEnterTitleEditMode}
                                    onEnterDescriptionEditMode={this.handleEnterDescriptionEditMode}
                                    isFocused={isFocused}
                                    onFocus={this.handleFocus}
                                    onUnfocus={this.handleUnfocus}
                                    onAddNewHeader={this.handleAddNewHeader} />
              </Collapse>

              <HeaderContent header={header} />
            </div>
          );
        }}
      </Motion>
    );
  }
}

const mapStateToProps = (state, props) => {
  const focusedHeader = !!state.org.present.get('focusedHeaderId') ? (
    headerWithId(state.org.present.get('headers'), state.org.present.get('focusedHeaderId'))
  ) : null;

  return {
    bulletStyle: state.base.get('bulletStyle'),
    focusedHeader,
    isFocused: !!focusedHeader && focusedHeader.get('id') === props.header.get('id'),
    inEditMode: state.org.present.get('inDescriptionEditMode') || state.org.present.get('inTitleEditMode'),
  };
};

const mapDispatchToProps = dispatch => ({
  org: bindActionCreators(orgActions, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(Header);
