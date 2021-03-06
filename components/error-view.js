const React = require('react');
const cn = require('classnames');
const ReactTooltip = require('react-tooltip');
const GeneralControls = require('./general-controls.js');

module.exports = React.createClass({
  getInitialState: function() {
    return {hovered: false};
  },
  enterView: function() {
    this.setState({hovered: true});
  },
  leaveView: function() {
    this.setState({hovered: false});
  },
  render: function() {
    return (
        <div className={'error'} onMouseEnter={this.enterView} onMouseLeave={this.leaveView}>
          <ReactTooltip place='bottom' effect='solid' />
          <div className={cn('controls', {hidden: !this.state.hovered, minimized: this.props.minimized})}>
            <div className='left' />
            <GeneralControls {...this.props} />
          </div>
          <img src={'img/sadface.png'}
               alt={'sadface because of error'}
               width={164} height={164}></img>
          <p className="error-message">{this.props.error}</p>
        </div>
    );
  }
});
