/*
 * Orangevolt Ampere Framework
 *
 * http://github.com/lgersman
 * http://www.orangevolt.com
 *
 * Copyright 2012, Lars Gersmann <lars.gersmann@gmail.com>
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

/**
 * Ampere Core
 */
;(window.ov && window.ov.ampere) || (function( $) {
	function object_values( arr) {
		var values = [];
		for( var key in arr) {
			values.push( arr[ key]);
		}

		return values;
	}

	function Options( defaults) {
		var _ = defaults || {};

		return function options() {
			if( arguments.length==2) {
				_[ arguments[0]] = arguments[1];
				return this;
			} else if( arguments.length==1) {
				var arg = arguments[0];
				if( $.isPlainObject( arg)) {
					angular.extend( _, arg);
					return this;
				} else {
					return _[ arg];
				}
			}
			return _;
		};
	}

		/**
		 * history implementing undo/redo.
		 *
		 * - create an instance:
		 *	var myCommandStack = History();
		 *
		 * - push actions into command stack     :
		 *	// redo with argument adds and executes a new action inside the undo/redo manager
		 *	myCommandStack.redo( function() {
		 *			// do something here
		 *		return function() {		// return a undo function if your action is undoable
		 *			// undo something here
		 *			// return redo function if your undo function is redoable
		 *		};
		 *	})
		 *
		 * - undo an action:
		 *	myCommandStack.undo();
		 *
		 * - redo an action:
		 *	myCommandStack.redo();
		 *
		 * - ask undo / redo state:
		 *	myCommandStack.canUndo(); myCommandStack.canRedo()
		 *
		 *attention : canUndo/canRedo return the count of undoable/redoable actions or 0 if nothing undoable/redoable instead of a boolean
		 *
		 * - reset:
		 *	myCommandStack.reset()
		 *
		 * - rollback all undo actions:
		 *	myCommandStack.rewind()
		 *
		 * - playback all redo actions:
		 *	myCommandStack.playback()
		 */
	function History( module, options) {
		if( !(this instanceof History)) {
			return new History( module, options);
		}

		options = options || {};

		var size = options['ampere.history.limit'];
		size = (size===undefined || size===null) ? 0 : size;

		var history = this;

		/**
		 * @return 0 (==false) if no undoable action are on stack or count of undoable actions
		 */
		this.canUndo = function() {
			return history.position;
		};

		/**
		 * @return 0 (==false) if no redoable action are on stack or count of redoable actions
		 */
		this.canRedo = function() {
			return history.stack.length-history.position;
		};

		this.canReset = function() {
			return history.stack.length;
		};

		var lastCommand;
		this.retry = function() {

		};

		this.canRetry = function() {
			return lastCommand;
		};

			/*
			 * this variable keeps the unique
			 * id counter for history entries
			 *
			 * if its undefefined html5 history support is
			 * not given (option is false or browser doesnt support it)
			 */
		var html5_history_hash;
		// h = $('body').ampere().module.history(); JSON.stringify( { stack : $( h.stack).map( function( index, item) { return this.hash;}).get(), position : h.position })
		if( size && options['ampere.history.html5'] && window.history && window.history.pushState) {
			html5_history_hash = parseInt( $.now() + '00', 10);

				// push initial state
			window.history.replaceState( html5_history_hash, document.title, window.location.pathname);// + '#' + html5_history_hash);

				// register history listener
			$( window).on( 'popstate', function( event) {
				if( event.originalEvent.state) {
					for( var i=0; i<history.stack.length; i++) {
						var entry = history.stack[ i];
							// this is the entry to go back to
						if( entry.hash==event.originalEvent.state) {
							if( i<history.position) {
								//console.warn( 'undo (length:' + history.stack.length + ',position:' + history.position + ',i:' + i + ')');
								history.undo( event);
							} else {
								//console.warn( 'redo (length:' + history.stack.length + ',position:' + history.position + ',i:' + i + ')');
								history.redo( event);
							}
							return;
						}
					}
				}
			});
		}

		/**
		 * @param action the new action to execute and store
		 * or undefined (i.e no argument) to redo the last undo action.
		 *
		 * if no redo action is available function returns gracefully
		 *
		 * @return the undo instance
		 */
		this.redo = function( /*parameter stucture  is { command : ..., source : ..., target : ..., view : ..., [ ui : ...]?}*/) {
			var redoCommand;
			if( arguments.length) {
				if( !(arguments[0] instanceof jQuery.Event)) {
					var ui = arguments.length && arguments[0].ui;
					var arg = arguments[0];
					var view = module.current().view;
					var undoCommand;

					redoCommand = function RedoCommand( historyReady) {
						var redoResult = module._transit( arg.command, arg.source, arg.target, arg.view, arg.ui, historyReady);

						if( !undoCommand) {
							if( $.isFunction( redoResult)) {
								undoCommand = function UndoCommand( historyReady) {
									var undoResult = module._transit( redoResult, arg.target, arg.source, view, arg.ui, historyReady);
									redoCommand.promise = $.when( undoResult).promise;
									return $.isFunction( undoResult) ? redoCommand : undefined;
								};
								undoCommand.target = arg.source;
								undoCommand.view = view;
							}
						}
						undoCommand && (undoCommand.promise = $.when( redoResult).promise);
						return $.isFunction( redoResult) ? undoCommand : undefined;
					};
					redoCommand.target = arg.target;
					redoCommand.view = arg.view;
				}
			} else if( html5_history_hash && history.canRedo() && !(arguments[0] instanceof jQuery.Event)) {
				// if html5 history is enabled and no argument given and redo enabled
				// trigger html 5 navigation forward
				window.history.forward();
			}

			var historyReady = $.Deferred();
			var redo = redoCommand || (history.canRedo() && history.stack[ history.position]);
			var undo = $.isFunction( redo) && redo( historyReady);

			$.when( undo)
			.done( function() {
				if( size>0) {
					if( undo) {
						undo.hash = window.history.state;
						if( redoCommand) {
							history.stack.splice( history.position);     // cleanup recent redo actions
							history.stack.push( undo);
							history.position = history.stack.length;

							html5_history_hash && historyReady.done( function() {
								var hash = ++html5_history_hash;
								window.history.pushState( hash, document.title, window.location.pathname);// + '#' + hash);
							});
						} else if( history.canRedo()) {
							html5_history_hash && historyReady.done( function() {
								undo.hash = /*window.history.state*/redo.hash-1;
								// window.history.replaceState( undo.hash, document.title, window.location.pathname + '#' + redo.hash);
							});
							history.stack[ history.position++] = undo;// point to next redo action
						}
					} else if( redo) {							// cleanup recent undo actions
						history.stack.splice( 0, history.position);
						history.position = history.stack.length;
					}

					if( history.stack.length>size) {
						history.stack.shift();
						history.position = history.stack.length;
					}
				} else {
				}
			})
			.always( historyReady.resolve);

			return redo;
		};
		this.redo.target = function RedoTarget() {
			return history.canRedo() && history.stack[ history.position].target;
		};

		/**
		 * execute the next undo action.
		 * returns gracefully if no redo action is available.
		 *
		 * @return the undo instance
		 */
		this.undo = function() {
			if( history.canUndo()) {
				if( html5_history_hash && !(arguments[0] instanceof jQuery.Event)) {
						// if html5 history is enabled and no argument given
						// trigger html 5 navigation back
					window.history.back();
				}

				var undo = history.stack[ --history.position];

				var historyReady = $.Deferred();
				var redo = undo( historyReady);

				$.when( redo)
				.done( function() {
					if( redo) {
						html5_history_hash && historyReady.done( function() {
							redo.hash = /*window.history.state*/undo.hash+1;
							//window.history.replaceState( redo.hash, document.title, window.location.pathname + '#' + undo.hash);
						});
						history.stack[ history.position] = redo;	// replace undo by its returned redo action
					} else {								// cleanup recent redo actions
						history.stack.splice( history.position);
					}
				})
				.always( historyReady.resolve);
			}

			return this;
		};
		this.undo.target = function UndoTarget() {
			return history.canUndo() && history.stack[ history.position-1].target;
		};

		this.reset = function() {
			history.stack = [];
			history.position = 0;

			return history;
		};
		this.reset.target = function ResetTarget() {
			return module.current().state;
		};

		this.rewind	= function() {
			while( this.canUndo()) {
				this.undo( false);
			}
			return this;
		};

		this.playback = function() {
			while( this.canRedo()) {
				this.redo( false);
			}
			return this;
		};

		this.reset();

		return this;
	}

	function Transition( state, targetState, transitionName, module) {
		if( !(this instanceof Transition)) {
			return new Transition( state, targetState, transitionName, module);
		}

		var transition = this;

		this.options = Options();

		this.state = function () {
				// return state or (in case this is a module transition) current state
			return state || module.current().state;
		};

		//this.transitionName = transitionName;
		this.name = function () {
			return transitionName;
		};

		this.fullName = function () {
			return (state || module).fullName() + '.transitions.' + transitionName;
		};

		this.target = function () {
			return $.isFunction( targetState) ? targetState.call( this) : targetState;
		};

		this.action = (function() {
				/* we cannot use $.noop here.
				 *
				 * non history breaking default actions need to return
				 * a undo function for ampere modules supporting undo/redo
				 */
			function Noop() {
				return Noop;
			}
			var delegate = Noop;

			return function action() {
				if( arguments.length) {
					$.ov.namespace(	this.fullName() + '.action()').assert(
						arguments.length==1 && $.isFunction( arguments[0]),
						'function expected as argument'
					);
					delegate = arguments[0];
					return this;
				} else {
					return delegate;
				}
			};
		})();

		this.enabled = (function() {
			var delegate = function() {
				return true;
			};

			return function() {
				if( arguments.length) {
					var fn = arguments[0];
					if( !$.isFunction( fn)) {
						var value = arguments[0];
						fn = function() {
							return value;
						};
					}
					$.ov.namespace(	this.fullName() + '.enabled()').assert(
						arguments.length==1, 'single argument expected'
					);
					delegate = fn;
					return this;
				} else {
					var enabled = delegate.call( this, this);
					return enabled;
				}
			};
		})();

		this.active = (function() {
			var delegate = $.noop;

			return function() {
				if( arguments.length) {
					var fn = arguments[0];
					if( !$.isFunction( fn)) {
						var value = arguments[0];
						fn = function() {
							return value;
						};
					}
					$.ov.namespace(	this.fullName() + '.active()').assert(
						arguments.length==1, 'single argument expected'
					);

					delegate = fn;
					return this;
				} else {
					var active = delegate.call( this, this);
					return active;
				}
			};
		})();
	}

	function View( state, viewName, template) {
		if( !(this instanceof View)) {
			return new View( state, viewName, template);
		}

		var view = this;

		this.options = Options();

		this.state = function() {
			return state;
		};

		this.name = function() {
			return viewName;
		};

		this.fullName = function () {
			return state.fullName() + '.views.' + viewName;
		};

		this.template = function() {
			return template;
		};
	}

	function State( module, stateName) {
		if( !(this instanceof State)) {
			return new State( module, stateName);
		}

		var state = this;

		this.options = Options();

		this.module = function() {
			return module;
		};

		this.name = function() {
			return stateName;
		};

		this.fullName = function () {
			return module.fullName() + '.states.' + stateName;
		};

		var prototype = this;
		this._super = function( deferred) {

		};

		this.transitions = {};
		/**
		 * <state>.transition( myState)
		 *	registers a new transition targeting myState without any action
		 * <module>.transition( name, myState)
		 *	registers a new transition targeting myState with name "name"
		 */
		this.transition = function() {
			var _ns = $.ov.namespace( this.fullName() + '.transition()');

			var targetState;
			var transitionName;
			if( arguments.length) {
				if( arguments.length==1) {
					if( typeof( arguments[0])=='string') {
						targetState = this;
						transitionName = arguments[0];
					} else if( arguments[0] instanceof State) {
						targetState = arguments[0];
						transitionName = targetState.name();
					} else if( $.isFunction( arguments[0])) {
						targetState = arguments[0];
						transitionName = window.ov.ampere.util.functionName( targetState) ? window.ov.ampere.util.functionName( targetState) : 'main';
					} else {
						_ns.raise( 'dont know how to handle arguments ', arguments);
					}
				} else if( arguments.length==2) {
					transitionName = arguments[0];
					targetState = arguments[1];
				} else {
					_ns.raise( 'too much arguments ', arguments);
				}
			} else {
				targetState = this;
				transitionName = targetState.name();
			}

			_ns
			//.assert( targetState instanceof State, 'argument targetState expected to be a state, but it is ', targetState)
			//.assert( $.inArray( targetState, object_values( module.states))!=-1, 'argument targetState expected to be a state of same module')
			.assert( $.isFunction( targetState) || targetState instanceof State, 'argument targetState expected to be a state or function returning a state, but it is ', targetState)
			.assert( $.isFunction( targetState) || $.inArray( targetState, object_values( module.states))!=-1, 'argument targetState expected to be a state of same module')
			.assert( !this.transitions[ transitionName], 'transition "', transitionName, '" already exists');

			this.transitions[ transitionName] = Transition( this, targetState, transitionName);
			return this.transitions[ transitionName];
		};

		this.views = {};
		/**
		 * <state>.view( 'foo')
		 *	registers a new view foo
		 * <state>.view( function foo() { ...})
		 *	registers function as new view 'foo'
		 * <state>.view( 'foo', function() { ...})
		 *	registers function as new view foo
		 */
		this.view = function() {
			var _ns = $.ov.namespace( this.fullName() + '.view()')
			.assert( arguments.length, 'no arguments given');

			var viewName = arguments.length>1 ? arguments[0] : undefined;
			var template = arguments[ arguments.length>1 ? 1 : 0];

			if( !viewName) {
				if( $.isFunction( template)) {
					viewName = window.ov.ampere.util.functionName( template);
				} else if( (template||{}).jquery) {
					viewName = template.selector;
				}

				viewName = viewName || 'main';
			}

			_ns.assert( !this.views[ viewName], 'view "' + viewName + '" already exists');
			_ns.assert( template || template==='' || template==null, 'view "' + viewName + '" : template argument missing');

			return this.views[ viewName] = new View( this, viewName, template);
		};
		this.view.load = function( name , url) {
			if( arguments.length==1) {
				return state.view( 'main', $.get( arguments[0]));
			} else {
				return state.view( name || 'main', $.get( url));
			}
		};
	}

	function Module( ampere, moduleName) {
		if( !(this instanceof Module)) {
			return new Module( ampere, moduleName);
		}

		this.ampere = function() {
			return ampere;
		};

		this.name = function() {
			return moduleName;
		};

		this.fullName = function() {
			return 'ampere.modules.' + moduleName;
		};

		this._super = function() {
			var module = this;

			this.options = Options();

			var current = { state : undefined, view : undefined, reset : undefined};
			this.current = function( state, view, /* optional */ ui) {
				if( arguments.length==2 || arguments.length==3) {
					$.ov.namespace( module.fullName() + '.current()').assert(
						$.inArray( state, object_values( module.states))!=-1,
						'argument expected to be state of same module'
					);

					$.ov.namespace( module.fullName() + '.current()').assert(
						!view || $.inArray( view, object_values( state.views))!=-1,
						'argument expected to be view of state "', state.name(),'"'
					);

					current.state = state;
					current.view  = view;

					current.reset = {};
					var keys = Object.keys( state);
					for( var i=0; i<keys.length; i++) {
						if( keys[i]!='promise') {
							if( typeof( current.state[ keys[i]])!='object' || $.isPlainObject( current.state[ keys[i]])) {
								$.ov.namespace( module.fullName() + '.current.reset()').debug( 'backup property ', keys[i]);
								current.reset[ keys[i]] = angular.copy( current.state[ keys[i]]);
							}
						}
					}
				} else if( !arguments.length) {
					return current;
				} else {
					$.ov.namespace( module.fullName() + '.current()').raise(
						'2 or no arguments expected but ', arguments, ' given'
					);
				}
			};
			this.current.reset = function() {
				var i;
					// remove all individual properties
				var keys = Object.keys( current.state);
				for( i=0; i<keys.length; i++) {
					if( keys[i]!='promise') {
						$.ov.namespace( module.fullName() + '.current.reset()').debug( 'delete property ', keys[i]);
						delete current.state[ keys[i]];
					}
				}

					// set data from current.reset
				keys = Object.keys( current.reset);
				for( i=0; i<keys.length; i++) {
					if( typeof( current.reset[ keys[i]])!='object' || $.isPlainObject( current.reset[ keys[i]])) {
						$.ov.namespace( module.fullName() + '.current.reset()').debug( 'set property ', keys[i], '=', current.reset[ keys[i]]);
						current.state[ keys[i]] = angular.copy( current.reset[ keys[i]]);
					}
				}
			};

			this.states = {};
			/**
			 * <module>.state( 'foo')
			 *	registers a new state foo and returns it
			 * <module>.state( function foo() { ...})
			 *	registers function as new state 'foo' and returns it
			 * <module>.state( 'foo', function() { ...})
			 *	registers function as new state foo and returns it
			 * <module>.state( ['first', function second( state) { ...}, 'third'])
			 *	registers 3 states first, second, third at once.
			 *	second will be initialized using its function name (this and arguments[0] provides the state)
			 *	returns nodule
			 * <module>.state( { first : function( state) {}, second : function( state) {}, 'third' : function( state) {}})
			 *	registers 3 states first, second, third at once.
			 *	key is taken as state name and function will be called as initializer (this and arguments[0] provides the state)
			 *	returns nodule
			 */
			this.state = function() {
				var _ns = $.ov.namespace( this.fullName() + '.state()').assert( arguments.length, 'no arguments given');
				var name, i;
				if( arguments.length==1 && $.isArray( arguments[0])) {
					var arr = arguments[0];
						// create states
					for( i=0; i<arr.length; i++) {
						_ns.assert( $.isFunction( arr[i]) || typeof( arr[i])=='string', 'array item type "function" or "string" expected');
						this.state( $.isFunction( arr[i]) ? window.ov.ampere.util.functionName( arr[i]) : arr[i]);
					}
						// initialize states
					for( i=0; i<arr.length; i++) {
						$.isFunction( arr[i]) && arr[i].call( this.states[ window.ov.ampere.util.functionName( arr[i])], this.states[ window.ov.ampere.util.functionName( arr[i])]);
					}
					return this;
				} else if( arguments.length==1 && $.isPlainObject( arguments[0])) {
					var obj = arguments[0];
						// create states
					for( name in obj) {
						this.state( name);
					}

					/*
					 * make state a deferred
					 */
					var dependencies = [];

						// intialize states
					for( name in obj) {
						_ns.assert( $.isFunction( obj[name]), 'initializer function expected as value of state "' , name + '"');
						dependencies.push(
							obj[name].call( this.states[ name], this.states[ name])
						);

					}
					this.promise = $.when.apply( $.when, dependencies).promise;
					return this;
				} else {
					var args = $.makeArray( arguments);
					name = args.shift();

					var fn   = $.isFunction( name) ? name : args.shift() || $.noop;
					name = typeof( name)=='string' ? name : window.ov.ampere.util.functionName( name);
					_ns.assert( !this.states[ name], 'state "' + name + '" already exists');

					var state = function() {
							/*
							 * make state a deferred
							 */
						var dependencies = [];

						$.isFunction( this.promise) && dependencies.push( this.promise());
						dependencies.push( fn.call( this, this));
						this.promise = $.when.apply( $.when, dependencies).promise;
					};
					state.prototype = State( this, name);
					this.states[name] = new state();

					return this.states[ name];
				}
			};

			this.transitions = {};
			/**
			 * <module>.transition( <state>function)
			 *	registers a new transition with a dynamic target
			 * <module>.transition( myState)
			 *	registers a new transition targeting myState
			 * <module>.transition( name, myState)
			 *	registers a new transition targeting myState with name "name"
			 */
			this.transition = function() {
				var _ns = $.ov.namespace( this.fullName() + '.transition()').assert( arguments.length, 'no arguments given');

				var targetState;
				var transitionName;
				if( arguments.length) {
					if( arguments.length==1) {
						if( arguments[0] instanceof State) {
							targetState = arguments[0];
							transitionName = targetState.name();
						} else if( $.isFunction( arguments[0])) {
							targetState = arguments[0];
							transitionName = window.ov.ampere.util.functionName( targetState)!=='' ? window.ov.ampere.util.functionName( targetState) : 'main';
						} else if( typeof( arguments[0])=='string') {
							targetState = this.states[ arguments[0]];
							transitionName = arguments[0];
						} else {
							_ns.raise( 'dont know how to handle arguments ', arguments);
						}
					} else if( arguments.length==2) {
						transitionName = arguments[0];
						targetState = arguments[1];
					} else {
						_ns.raise( 'dont know how to handle arguments ', arguments);
					}
				}

				_ns
				.assert( $.isFunction( targetState) || targetState instanceof State, 'argument targetState expected to be a state or function returning a state, but it is ', targetState)
				.assert( $.isFunction( targetState) || $.inArray( targetState, object_values( module.states))!=-1, 'argument targetState expected to be a state of same module')
				.assert( !this.transitions[ transitionName], 'transition "', transitionName, '" already exists');

				this.transitions[ transitionName] = Transition( null, targetState, transitionName, this);

				return this.transitions[ transitionName];
			};

			this._transit = function( command, source, target, view, /* optional argument */ui, /* optional argument */historyReady) {
				var retryArgs = {
					command	: command,
					source	: source,
					target	: target,
					view	: view,
					ui		: ui
				};

				ui && ui.block();
				var result;
				if( command) {
					try {
							// call action
						result = command.call( command, source, target);
					} catch( ex) {
						result = $.Deferred();
						result.reject( ex);
					}
				}

					// render "transaction in progress" overlay
				if( result && $.isFunction( result.promise) && result.promise().state()=='pending') {
					ui && ui.render( 'Action', result);
				}

				var self = this;

				function errorHandler() {
					if( arguments.length==1 && arguments[0]==self) {
						/*
						 * deferred failed controlled by user
						 * (ui rejects with module instance as argument to indentify this case)
						 * so the only thing to do is unblock the view
						 */

						ui && ui.unblock();
							// render flash "user aborted transition"
					} else if( ui) {
						var onRetry = function() {
							module.history().redo( retryArgs);
						};
							/*
							 * the action failed for some unknown reason
							 */
						if( arguments.length==1 && typeof( arguments[0])=='string') {
							ui.render( 'Error', arguments[0], onRetry);
						} else if( arguments.length==1 && (arguments[0] instanceof Error)) {
							ui.render( 'Error', arguments[0], onRetry);
							throw arguments[0];
						} else if( arguments.length==3 && ($.isFunction( arguments[0].statusCode))) {
							ui.render( 'Error', 'Ajax request failed (' + arguments[0].status + ') : ' + arguments[0].statusText || arguments[0].responseText, onRetry);
							throw arguments[0].responseText;
						} else {
							ui.render( 'Error', $.ov.json.stringify( arguments, $.ov.json.stringify.COMPACT), onRetry);
						}
					}
				}

				$.when( result, historyReady)
				.done( function() {
					module.current( target, view);
					var template = ui && ui.getTemplate( view);
					template
					.done( function( data) {
						if( data instanceof HTMLElement) {
							data = $( data);
						}
						template = data.jquery ? (data[0].tagName=='SCRIPT' ? data.text().replace( "<![CDATA[", "").replace("]]>", "") : data) : template.responseText || data;

						ui && ui.render( 'State', view, template, result);
						ui && ui.unblock();
					})
					.fail( errorHandler);
				})
				.fail( errorHandler);

				return result;
			};
		};
	}

	var ampereInstances = {};
	/**
	 * window.ampere()
	 *  create new ampere instance
	 */
	function Ampere( name, options) {
		if( !(this instanceof Ampere)) {
				// process arguments
			switch( arguments.length) {
				case 0 :
					name = '';
					options = {};
					break;
				case 1 :
					var isStringArg = typeof( name)=='string';
					name = isStringArg && name || '';
					options = isStringArg && {} || options;
					break;
			}

				// if ampere instance exists
			if( ampereInstances[ name]) {
					// patch new options into it
				ampereInstances[ name].options = Options( angular.extend( ampereInstances[ name].options(), options));
				return ampereInstances[ name];
			} else {
				return ampereInstances[ name]=new Ampere( name, options);
			}
		}

		var ampere = this;
		this.options = Options( angular.extend( {}, Ampere.defaults, options));
		this.modules = {};
		/**
		 * window.ov.ampere( 'foo')
		 *	returns module foo
		 * window.ov.ampere( function foo() { ...})
		 *	registers function as new module foo
		 * window.ov.ampere( 'foo', function() { ...})
		 *	registers function as new module foo
		 */
		this.module = function module() {
			var _ns = $.ov.namespace( 'ampere.module()').assert( arguments.length, 'no arguments given');

			var args = $.makeArray( arguments);
			var name = args.shift();

			if( typeof( name)=='string' && !args.length) {
				_ns.assert( false, 'not enough arguments : ', arguments);
			}

			var fn   = $.isFunction( name) ? name : args.shift();
			name = typeof( name)=='string' ? name : window.ov.ampere.util.functionName( fn);
			_ns.assert( name && name!=='', 'module name not given (module constructor function seems also anonymous)');
			_ns.assert( !this.modules[ name], 'module "' + name + '" already exists');

			var _defaults = { };
			this.modules[ name] = function( options) {
				if( this instanceof Module) {
					this._super();
					this.options( angular.extend( {}, this.ampere().options(), _defaults, options));

					var history = History( this, this.options());
					this.history = function() {
						return history;
					};

						// module function may return a deferred
					var deferred = fn.call( this, this);
					_ns.assert( !$.isEmptyObject( this.states), 'cannot instantiate module without any states');

						/*
						 * prepare a deferred representing the whole module
						 */
					var dependencies = object_values( this.states);
					dependencies.push( deferred);
					$.isFunction( this.promise) && dependencies.push( this.promise());

					var module = this;
					this.promise = $.when.apply( $.when, dependencies)
					.done( function() {
						/*
						 * ensure all states have a view
						 * otherwise create a default view for the state
						 */
						var getCaption = function( view, ui) {
							return ui.getCaption( view.state());
						};
						var getDescription = function(view, ui) {
							return ui.getDescription( view.state());
						};
						for( var name in module.states) {
							var state = module.states[name];
							if( $.isEmptyObject( state.views)) {
								state.view( 'main', null).options({
									'ampere.ui.caption' : getCaption,
									'ampere.ui.description' : getDescription
								});
							}
						}
					})
					.fail( function() {
						_ns.error( 'failed to load module "', module.name(), '" : ', arguments);
					})
					.promise;
				} else {
					return new this.modules[ name]();
				}
			};
			this.modules[ name].defaults = function( defaults) {
				_defaults = defaults;
				return ampere.modules[ name];
			};

			this.modules[ name].prototype = Module( ampere, name);

			return this.modules[ name];
		};
	}
	Ampere.defaults = {
			/* default state name */
		'ampere.state'         : 'main',
		'ampere.state.view' : 'main',
			/* 'ui' : controller: foobarUI, */
		'ampere.ui.options'		: {},
			/*
			 * history is enabled by default
			 * set Number.MAX_VALUE as value for infinite undo/redo stack
			 */
		'ampere.history.limit'	: Number.MAX_VALUE,
			/*
			 * enable html5 history api support (if the browser supports it)
			 * if enabled the browser back/forward buttons
			 * can be used to navigate in the browser history
			 *
			 * this option has only effect when options
			 * 'ampere.history.limit' is >0 (i.e. enabled)
			 *
			 * ATTENTION : $.fn.ampere overrides this option
			 * (if not defined) to true if the attached element is BODY
			 */
		'ampere.history.html5'	: false,
			/*
			 * baseurl defaults to the Orangevolt Ampere Loader baseurl
			 * (i.e. path to oval.js)
			 */
		'ampere.baseurl'		: (function() {
			var scripts = document.getElementsByTagName( 'script');
			for( var i=0; i<scripts.length; i++) {
				var url = scripts[i].src;
				if( /oval.js/.test( url)) {
					var matches = url.match( /(.+)oval\.js(\?(.+))?/);
					if( matches) {
						return matches[ 1];
					}
				}
			}

			return document.location.href;
		})()
	};

	/**
	 * returns the type of the given object
	 */
	Ampere.type = function type( object) {
		if( object instanceof Ampere) {
			return 'ampere';
		} else if( object instanceof Module) {
			return 'module';
		} else if( object instanceof State) {
			return 'state';
		} else if( object instanceof Transition) {
			return 'transition';
		} else if( object instanceof View) {
			return 'view';
		} else {
			return $.type( object);
		}
	};

	/**
	 * ampere ui prototype.
	 * each renderer must derive from this
	 */
	function Ui() {
		if( !(this instanceof Ui)) {
			return new Ui();
		}

		this._super = function( controller, options) {
			this.options = Options( angular.extend( {}, Ampere.defaults.ui, options));
			this.controller = controller;
			this._ns = $.ov.namespace( controller.module.fullName() + '::UI');

			var self = this;

			this.onHotKey = function onHotkey( event) {
				if( !self.isBlocked() && $.inArray( event.target.tagName, ['TEXTAREA', 'SELECT', 'INPUT'])==-1) {
					var matchingHotkeys = window.ov.ampere.ui.hotkey.computeMatchingHotkeys( event);
					var module = self.controller.module;

					var proceedTransitionHotkey = function( transition, ngAmpereHotkey, domElement) {
						var hotkey = ngAmpereHotkey || transition.options( 'ampere.ui.hotkey');

						if( transition.enabled() && hotkey) {
							var _hotkey = hotkey.replace(/\+/g, '_').toLowerCase();
							if( $.inArray( _hotkey, matchingHotkeys)!=-1) {
								self._ns.debug( 'hotkey ' + hotkey + ' matched');

								event.preventDefault();
									// prevent any other hotkey handler to be invoked
								event.stopImmediatePropagation();

									// patch matching hotkey element into event
								event.currentTarget = event.delegateTarget = event.srcElement = event.target = domElement;
									// provide patched event to transition action
								self.controller.proceed( transition, [event]);

								return true;
							}
						}
					};

						// inspect ng-ampere-hotkey attributed elements (i.e. not transitions)
					var i, element, elements = $( '*[ng-ampere-hotkey]', self.controller.element).get();
					for( i in elements) {
						element = $( elements[i]);
						var hotkeys = element.data( 'ampereHotkey');

						for( var hotkey in hotkeys) {
							var _hotkey = hotkey.replace(/\+/g, '_').toLowerCase();
							if( $.inArray( _hotkey, matchingHotkeys)!=-1) {
								self._ns.debug( 'hotkey ' + hotkey + ' matched');

								event.preventDefault();
									// prevent any other hotkey handler to be invoked
								event.stopImmediatePropagation();

								var value = hotkeys[ hotkey];
								if( value instanceof Transition) {
										// patch matching hotkey element into event
									event.currentTarget = event.delegateTarget = event.srcElement = event.target = element[0];
										// provide patched event to transition action
									self.controller.proceed( value, [event]);
								} else {
									var scope = angular.element( element).scope();
									scope.$apply( value);
								}

								return;
							}
						}
					}

						// inspect transitions with an ampere hotkey provided as ng-ampere-hotkey attribute
					elements = $( '.ampere-transition[data-ampere-hotkey!=""]', self.controller.element).get();
					for( i in elements) {
						element = $( elements[i]);
						if( element.hasClass( 'ampere-transition')) {
							var transition = element.data( 'ampereTransition');
							if( transition && proceedTransitionHotkey( transition, undefined, element.data( 'ampere-hotkey', self.controller.element), element[0])) {
								return;
							}
						}
					}

						// inspect current state's transitions
					for( i in module.current().state.transitions) {
						if( proceedTransitionHotkey( module.current().state.transitions[i], undefined, $( '.ampere-view:first', self.controller.element)[0])) {
							return;
						}
					}

						// inspect module transitions
					for( i in module.transitions) {
						if( proceedTransitionHotkey( module.transitions[i], undefined, $( '.ampere-module:first', self.controller.element)[0])) {
							return;
						}
					}
				}
			};
		};

			/**
			 * init should be overridden by implementations to
			 *
			 * * install event handlers
			 */
		this.init = function() {
			$( this.controller.element).on( 'keydown', this.onHotKey);
		};

			/**
			 * destroy should be overridden by implementations to
			 *
			 * * uninstall event handlers
			 */
		this.destroy = function() {
			$( this.controller.element).off( 'keydown', this.onHotKey);
		};

			/**
			 * block user input
			 */
		this.block = function() {};

			/**
			 * unblock user input
			 */
		this.unblock = function() {};

			/**
			 * @return true if ui  is blocked
			 */
		this.isBlocked = function() {};

			/**
			 * flashes the message. if called without any parameters the flash gets hidden.
			 *
			 * @return flash
			 */
		this.flash = function( message) {};
			/**
			 * shows error in flash.
			 * @fnRetry optional, argument can be a function for retrying the operation.
			 *
			 * @return flash
			 */
		this.flash.error = function( message, /*optional*/fnRetry) {};
			/**
			 * shows message as flash with progress
			 * @param progress optional, is expected to be a string with format /\d{1-3}%/
			 * @deferred optional, if given progress can be aborted
			 *
			 * @return flash
			 */
		this.flash.progress = function( message, progress, deferred) {};
			/**
			 * open an modal dialog
			 *
			 * @param url
			 * @param initializer
			 * @param options
			 */
		this.modal = function( url, /* function */ initializer, /*optional */ options) {};

			/**
			 * filter may be an object (filter by example, like { type : 'global'}) or function argument
			 */
		this.getTransitions = function( filter) {
			var filterFn = filter || $.noop;
			if( !$.isFunction( filterFn)) {
				this._ns.assert( $.isPlainObject( filter), 'argument "filter" expected to be a function or plain object');
				filterFn = function() {
					for( var option in filter) {
						var filterValue = filter[ option];
						var value = this.options( option);
						if( filterValue instanceof RegExp) {
							return filterValue.test( value || '');
						} else {
							return filterValue===value;
						}
					}
				};
			}

			var names, index, transition;
			var transitions = [];
			names = Object.keys( this.controller.module.transitions);
			for( index in names) {
				transition = this.controller.module.transitions[ names[index]];
				filterFn.call( transition) && transitions.push( transition);
			}

			names = Object.keys( this.controller.module.current().state.transitions);
			for( index in names) {
				transition = this.controller.module.current().state.transitions[ names[index]];
				filterFn.call( transition) && transitions.push( transition);
			}

			return transitions;
		};

		this.regexp = function( pattern,modifiers) {
			return new RegExp( pattern,modifiers);
		};

		this.render = function( event) {
			if( $.isFunction( this['render' + event])) {
				var args = $.makeArray( arguments);
				args.shift();

				return this['render' + event].apply( this, args);
			} else {
				$.ov.namespace( 'ampere.ui').debug( 'skip rendering event "' + event + '" for module "' + this.controller.module.fullName() + '" - no matching function "render' + event + '" defined in renderer');
			}
		};

			/**
			 * GENERIC INTERNAL FUNCTION
			 * @returns the generic ui property for an type
			 */
		this._get = function( property, object, /* (optional)array<string> */ allowedParentTraversalTypes) {
			if( !object) {
				debugger;

			}

			var value;
			if( $.isFunction( this.options( property))) {
				value = this.options( property).call( this, object);
			}

			if( value===undefined) {
				if( $.isFunction( object.options)) {
					if( object instanceof Transition) {
						value = object.options( property);

						var targetState = object.target();
						if( value===undefined && $.inArray( 'target', allowedParentTraversalTypes)!=-1 && targetState && targetState!==object.state()) {
							object = targetState;
						}
					}

					if( object instanceof View) {
						value = object.options( property);
						if( value===undefined && $.inArray( 'state', allowedParentTraversalTypes)!=-1) {
							object = object.state();
						}
					}

					if( object instanceof State) {
						value = object.options( property);

						if( value===undefined && $.inArray( 'module', allowedParentTraversalTypes)!=-1) {
							object = object.module();
						}
					}

					if( object instanceof Module) {
						value = object.options( property);
					}
				}
			}

			return $.isFunction( value) ? value.call( object, object, this) : value;
		};

		this.getHotkey = function( object) {
			var hotkey = this._get( 'ampere.ui.hotkey', object, ['transition', 'view', 'target', 'state']);
			return typeof( hotkey)=='string' ? window.ov.ampere.util.ucwords( hotkey) : hotkey;
		};

		this.getCaption = function( object) {
			var caption = this._get( 'ampere.ui.caption', object, ['transition', 'view', 'target', 'state']);
			if( caption===undefined) {
				if( object instanceof Transition) {
					caption = window.ov.ampere.util.ucwords( object.name());
				} else if( object instanceof View) {
					caption = window.ov.ampere.util.ucwords( object.name());
				} else if( object instanceof State) {
					caption = window.ov.ampere.util.ucwords( object.name());
				} else if( object instanceof Module) {
					caption = window.ov.ampere.util.ucwords( object.name());
				} else if ( typeof( object)=='string') {
					caption = window.ov.ampere.util.ucwords( object);
				}
			}

			return caption!==undefined ? caption : object;
		};

		this.getDescription = function( object) {
			return this._get( 'ampere.ui.description', object, ['transition', 'view', 'target', 'state']);
		};

		this.getAbout = function( object) {
			return this._get( 'ampere.ui.about', object);
		};

		this.getIcon = function( object) {
			return this._get( 'ampere.ui.icon', object, ['transition', 'view', 'target', 'module']);
		};
	}
	Ampere.ui = Ui;

	/**
	 * the ampere "engine" implementation
	 */
	function UiController( element, module, options) {
		if( !(this instanceof UiController)) {
			return new UiController( element, module, options);
		}

		var controller = this;

		var _ns = $.ov.namespace( module.fullName() + '::UiController');

		this.options = Options( options);
		this.module = module;
		this.element = element;

			// reset history to potentially remove
			// undo entries from previous usage
		module.history().reset();

			/*
			 * initialize
			 */
		this.element.addClass( 'ampere-app');

		$.when( module).done( function() {
			// (1) state
			var state = controller.options( 'ampere.state') || controller.module.current().state || module.options( 'ampere.state');
			if( typeof( state)=='string') {
				var _state = module.states[ state];
				_ns.assert( _state instanceof State, 'configured default state "', state, '" not found in ', module.fullName(), '.states');

				state = _state;
			} else if( !state) {
				for( var key in module.states) {
					state = module.states[ key];
					break;
				}
			}
			/*
			 * no more needed - its already ensured in module initializer
			 * _ns.assert( state instanceof State, 'could not evaluate initial state');
			*/

				// (2) view
			var view = controller.options( 'ampere.view') || controller.module.current().view || module.options( 'ampere.view');
			if( typeof( view)=='string') {
				var _view = state.views[ view];
				_ns.assert( _view instanceof View, 'configured default view "', view, '" not found in ', state.fullName() + '.views');

				view = _view;
			} else if( !view) {
				for( var i in state.views) {
					view = state.views[ i];
					break;
				}
			}

				// (3) ui
			controller.ui = controller.options( 'ampere.ui') || module.options( 'ampere.ui');
			_ns.assert( !(controller.ui instanceof Ampere.ui), "controller.options( 'ui') expected to be a ampere ui constructor function but is an object ", controller.ui);
			controller.ui = new controller.ui( controller, angular.extend( {}, module.options(), controller.options()));

			/*
			 * no more needed - its already ensured in module initializer
			 * _ns.assert( view instanceof View, 'no default view "', view, '" not found in ', state.fullName(), '.views');
			 */

			module.current( state, view);

			controller.element.data( 'ampere.controller', controller);
			controller.ui.render( 'Bootstrap');
		});

			/*
			 * --
			 */

		this.proceed = function( transition, /*optional transition data from events*/data) {
				// if transistion is enabled und target state defined
			var target;
			if( transition.enabled() && (target=transition.target())) {
					// get action factory
				var action = transition.action();
					/*
					 * handle special cases undo and redo
					 */
				if( action===this.module.history().undo || action===this.module.history().redo) {
					action.call( this.module.history());
				} else if( action===this.module.history().reset) {
					action.call( this.module.history());
						// update current view
					this.ui.render( 'State');
				} else if( action===this.module.current.reset) {
					this.module.current.reset();
						// update current view
					this.ui.render( 'State', this.module.current().view);
				} else {
						// create a new action
					var command = action.call( transition, transition, this.ui, data);

					if( !command) {
							// no command returned -> abort proceeding
						return false;
					} else {
							/*
							 * when action returned a function -> wrap it within a deferred
							 * otherwise assume the returned object is a deferred/promise
							 *
							 * in both cases actionDeferred should keep afterwards a promise
							 * returning the real command/redo function as argument of the done handler
							 */
						var actionDeferred = !$.isFunction( command) ?
							command	: $.Deferred( function() {
								this.resolve( command);
							});

							// wait for action to complete
						actionDeferred.done( function( command) {
								// compute target view
							var view = transition.options( 'ampere.state.view') || target.options( 'ampere.state.view');
							if( typeof( view)=='string') {
								var _view = target.views[ view];
								_ns.assert( _view instanceof View, 'target view "', view, '" not found in ', target.fullName(), '.views');

								view = _view;
							} else if( !view) {
								for( var key in target.views) {
									view = target.views[ key];
									break;
								}
							}
							/*
							 *  // this cannot happen anymore
							 *  _ns.assert( view instanceof View, 'no default view "', view, '" found in ', target.fullName(), '.views');
							 */

							controller.module.history().redo({
								command	: command,
								source	: transition.state(),
								target	: transition.target(),
								view    : view,
								ui		: controller.ui
							});
						});
					}
				}
				return true;
			} else {
				return false;
			}
		};

		this.destroy = function() {
			this.element.removeClass( 'ampere-app');
			this.ui.destroy();
		};

		this.getView = function( transition) {
			var view = this.module.current().state.options( 'ampere.state.view') || this.module.options( 'ampere.state.view');

			if( $.isFunction( view)) {
				view = view.call( view, this.module.current().state);
			}

			if( this.module.current().state.views[ view]) {
				return this.module.current().state.views[ view];
			} else {
				var viewNames=Object.keys( this.module.current().state.views);
				if( viewNames.length==1) {
					return this.module.current().state.views[ viewNames[0]];
				} else if( this.module.current().state.views[ 'main']) {
					return this.module.current().state.views[ 'main'];
				} else {
					return this.module.current().state.views[ viewNames[0]];
				}
			}
		};
	}

	window.ov = window.ov || {};
	window.ov.ampere = Ampere;

	$.fn.ampere = function( module, options) {
		if( arguments.length) {
			options = options || {};
			if( $.isFunction( module)) {
					// enable html5 by default (i.e. if not set in options)
					// if the ampere module will be attached to the BODY element
					// and ampere is not running within an iframe
				if( !('ampere.history.html5' in options)) {
					options['ampere.history.html5'] = this[0].tagName=='BODY' && window.top===window.self;
				}

				module = new module( options);
			}

			var _ns = $.ov.namespace( 'jQuery.fn.ampere()')
			.assert( module instanceof Module, 'argument expected to be a ampere module')
			.assert( this.length==1, 'context expected to reference a single dom element but was ', this.get());

			return UiController( this, module, options);
		} else {
			return this.data( 'ampere.controller');
		}
	};
})( jQuery);