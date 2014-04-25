/**
 * @fileoverview File to handle 'Type Blocking'. When the user starts typing the
 * name of a Block in the workspace, a series of suggestions will appear. Upon
 * selecting one (enter key), the chosen block will be created in the workspace
 * This file needs additional configuration through the inject method.
 * @author 
 */
'use strict';

goog.provide('Blockly.ViewBlock');

goog.require('goog.events');
goog.require('goog.events.KeyCodes');
goog.require('goog.events.KeyHandler');
goog.require('goog.events.ActionHandler'); 
goog.require('goog.ui.ac');
goog.require('goog.style');

goog.require('goog.ui.ac.ArrayMatcher');
goog.require('goog.ui.ac.AutoComplete');
goog.require('goog.ui.ac.InputHandler');
goog.require('goog.ui.ac.Renderer');

/**
 * Main Type Block function for configuration.
 * @param {Object} htmlConfig an object of the type:
     {
       frame: 'ai_frame',
       viewBlockDiv: 'ai_view_block',
       inputText: 'ac_view_input_text'
       previous: 'ac_button_previous', 
       next: 'ac_button_next',
       matchesText: 'ac_matches_text'
     }
 * stating the ids of the attributes to be used in the html enclosing page
 * create a new block
 */
Blockly.ViewBlock = function( htmlConfig ){
  Blockly.ViewBlock.viewBlockDiv_ = htmlConfig['viewBlockDiv'];
  Blockly.ViewBlock.inputText_ = htmlConfig['inputText'];
  Blockly.ViewBlock.buttonNext_ = htmlConfig['next']; 
  Blockly.ViewBlock.buttonPrevious_ = htmlConfig['previous'];
  Blockly.ViewBlock.matchesText_ = htmlConfig['matchesText']; 

  Blockly.ViewBlock.inputKh_ = new goog.events.KeyHandler(goog.dom.getElement(Blockly.ViewBlock.inputText_));
  Blockly.ViewBlock.nextAh_ = new goog.events.ActionHandler(goog.dom.getElement(Blockly.ViewBlock.buttonNext_)); 
  Blockly.ViewBlock.prevAh_ = new goog.events.ActionHandler(goog.dom.getElement(Blockly.ViewBlock.buttonPrevious_)); 

  Blockly.ViewBlock.handleKey = function(e){
    if (e.altKey || e.ctrlKey || e.metaKey || e.keycode === 9) return; // 9 is tab
    //We need to duplicate delete handling here from blockly.js
    if (e.keyCode === 8 || e.keyCode === 46) {
      // Delete or backspace.
      // If the panel is showing the panel, just return to allow deletion in the panel itself
      if (goog.style.isElementShown(goog.dom.getElement(Blockly.ViewBlock.viewBlockDiv_))) return;
      // if id is empty, it is deleting inside a block title
      if (e.target.id === '') return;
      // only when selected and deletable, actually delete the block
      if (Blockly.selected && Blockly.selected.deletable) {
        Blockly.hideChaff();
        Blockly.selected.dispose(true, true);
      }
      // Stop the browser from going back to the previous page.
      e.preventDefault();
      return;
    }
    if (e.keyCode === 27){ //Dismiss the panel with esc
      Blockly.ViewBlock.hide();
      return;
    }
    // A way to know if the user is editing a block or trying to type a new one
    if (e.target.id === '') return;
    if (goog.style.isElementShown(goog.dom.getElement(Blockly.ViewBlock.viewBlockDiv_))) {
      // Enter in the panel makes it select an option
      // if (e.keyCode === 13) Blockly.ViewBlock.hide();
      //SELECT do select after enter
    }
  };
  // Create the auto-complete panel
  Blockly.ViewBlock.createAutoComplete_(Blockly.ViewBlock.inputText_);
};


/**
 * Div where the view block panel will be rendered
 * @private
 */
Blockly.ViewBlock.viewBlockDiv_ = null;

/**
 * input text contained in the type block panel used as input
 * @private
 */
Blockly.ViewBlock.inputText_ = "Filter Blocks";

/** 
 * text to display the number of matches on filter bar
 * @private
 */ 
Blockly.ViewBlock.matchesText_ = ''; 

/**
 * button contained in filter panel, used to navigate through matches 
 * @private
 */
 Blockly.ViewBlock.buttonNext_ = null; 

 /**
 * button contained in filter panel, used to navigate through matches 
 * @private
 */
 Blockly.ViewBlock.buttonPrevious_ = null; 

/**
 * Action handler applied to next button, used to navigate through multiple
 * matches.  
 * @private
 */
 Blockly.ViewBlock.nextAh_ = null; 

 /**
 * Action handler applied to previous button, used to navigate through multiple
 * matches.  
 * @private
 */
 Blockly.ViewBlock.prevAh_ = null; 

/**
 * Input key handler applied to the View Block Panel, and used to catch
 * keyboard events. It is attached when the View Block panel is shown, and
 * dettached when the Panel is dismissed.
 * @private
 */
Blockly.ViewBlock.inputKh_ = null;

/**
 * Is the View Block panel currently showing?
 */
Blockly.ViewBlock.visible = false; //should make it true

/**
 * Mapping of options to show in the auto-complete panel. This maps the
 * canonical name of the block, needed to create a new Blockly.Block, with the
 * internationalised word or sentence used in viewblocks. Certain blocks do not only need the
 * canonical block representation, but also values for dropdowns (name and value)
 *   - No dropdowns:   this.viewblock: [{ translatedName: Blockly.LANG_VAR }]
 *   - With dropdowns: this.viewblock: [{ translatedName: Blockly.LANG_VAR },
 *                                        dropdown: {
 *                                          titleName: 'TITLE', value: 'value'
 *                                        }]
 *   - Additional types can be used to mark a block as isProcedure or isGlobalVar. These are only
 *   used to manage the loading of options in the auto-complete matcher.
 * @private
 */
Blockly.ViewBlock.VBOptions_ = {};

/**
 * This array contains only the Keys of Blockly.ViewBlock.VBOptions_ to be used
 * as options in the autocomplete widget.
 * @private
 */
Blockly.ViewBlock.VBOptionsNames_ = [];

/**
 * This array contains the matches from autocomplete widget to be used 
 * to navigate through multiple matches to a filter query. 
 * @private
 */ 
Blockly.ViewBlock.VBMatches_ = []; 

/**
 * Keeps track of the current block in the VBMatches_ array that the user
 * is or will be viewing after filtering the workspace. Is modified in the 
 * handleNext and handlePrevious listener functions.
 * @private
 */ 
Blockly.ViewBlock.VBMatchesIdx_ = 0; 

/**
 * pointer to the automcomplete widget to be able to change its contents when
 * the Language tree is modified (additions, renaming, or deletions)
 * @private
 */
Blockly.ViewBlock.ac_ = null;

/**
 * We keep a listener pointer in case of needing to unlisten to it. We only want
 * one listener at a time, and a reload could create a second one, so we
 * unlisten first and then listen back
 * @private
 */
Blockly.ViewBlock.currentListener_ = null;

/**
 * Listener function that allows the user to focus on the next element in the
 * VBMatches_ array created in createAutoComplete_. 
 */ 
Blockly.ViewBlock.handleNext = function(e) { 
  if (Blockly.ViewBlock.VBMatches_.length > 0) { 
    if (Blockly.ViewBlock.VBMatchesIdx_ + 1 >= Blockly.ViewBlock.VBMatches_.length) { 
      Blockly.ViewBlock.VBMatchesIdx_ = 0; 
    } else { 
      Blockly.ViewBlock.VBMatchesIdx_ += 1; 
    }
    var selectedBlock = Blockly.ViewBlock.VBMatches_[Blockly.ViewBlock.VBMatchesIdx_]; 
    var coords = selectedBlock.getRelativeToSurfaceXY(); 
    Blockly.mainWorkspace.scrollbar.set(coords.x, coords.y);
  } else {
    // console.log('No more matches for ' + blockName); 
  }
}; 

/**
 * Listener function that allows the user to focus on the previous element in the
 * VBMatches_ array created in createAutoComplete_. 
 */ 
Blockly.ViewBlock.handlePrevious = function(e) { 
  if (Blockly.ViewBlock.VBMatches_.length > 0) { 
    if (Blockly.ViewBlock.VBMatchesIdx_ - 1 < 0) { 
      Blockly.ViewBlock.VBMatchesIdx_ = Blockly.ViewBlock.VBMatches_.length - 1; 
    } else { 
      Blockly.ViewBlock.VBMatchesIdx_ -= 1; 
    }
    var selectedBlock = Blockly.ViewBlock.VBMatches_[Blockly.ViewBlock.VBMatchesIdx_]; 
    var coords = selectedBlock.getRelativeToSurfaceXY(); 
    Blockly.mainWorkspace.scrollbar.set(coords.x, coords.y);
  } else {
    // console.log('No more matches for ' + blockName); 
  }
}; 

/**
 * function to hide the autocomplete panel. Also used from hideChaff in
 * Blockly.js
 */
Blockly.ViewBlock.hide = function(){ //this should never be called
  if (Blockly.ViewBlock.viewBlockDiv_ == null)
    return;
  goog.style.showElement(goog.dom.getElement(Blockly.ViewBlock.viewBlockDiv_), false);
  goog.events.unlisten(Blockly.ViewBlock.inputKh_, 'key', Blockly.ViewBlock.handleKey);
  goog.events.unlisten(Blockly.ViewBlock.prevAh_, goog.events.ActionHandler.EventType.ACTION, Blockly.ViewBlock.handlePrevious); 
  goog.events.unlisten(Blockly.ViewBlock.nextAh_, goog.events.ActionHandler.EventType.ACTION, Blockly.ViewBlock.handleNext); 

  Blockly.ViewBlock.VBMatches_ = []; 
  Blockly.ViewBlock.visible = false;
  Blockly.ViewBlock.VBMatchesIdx_ = 0; 
};

/**
 * function to show the auto-complete panel to start typing block names
 */
Blockly.ViewBlock.show = function(){
  this.lazyLoadOfOptions_();
  var panel = goog.dom.getElement(Blockly.ViewBlock.viewBlockDiv_);
  goog.style.setStyle(panel, 'top', Blockly.latestClick.y);
  goog.style.setStyle(panel, 'left', Blockly.latestClick.x);
  goog.style.showElement(panel, true);
  goog.dom.getElement(Blockly.ViewBlock.inputText_).focus();

  // If the input gets cleaned before adding the handler, all keys are read
  // correctly (at times it was missing the first char)
  goog.dom.getElement(Blockly.ViewBlock.inputText_).value = '';
  goog.dom.getElement(Blockly.ViewBlock.matchesText_).innerHTML = ''; 
  goog.events.listen(Blockly.ViewBlock.inputKh_, 'key', Blockly.ViewBlock.handleKey);
  goog.events.listen(Blockly.ViewBlock.prevAh_, goog.events.ActionHandler.EventType.ACTION, Blockly.ViewBlock.handlePrevious); 
  goog.events.listen(Blockly.ViewBlock.nextAh_, goog.events.ActionHandler.EventType.ACTION, Blockly.ViewBlock.handleNext); 
  
  Blockly.ViewBlock.visible = true;
};

/**
 * Used as an optimisation trick to avoid reloading components and built-ins unless there is a real
 * need to do so. needsReload.components can be set to true when a component changes.
 * Defaults to true so that it loads the first time (set to null after loading in lazyLoadOfOptions_())
 * @type {{components: boolean}}
 */
Blockly.ViewBlock.needsReload = {
  components: true
};

/**
 * Lazily loading options because some of them are not available during bootstrapping, and some
 * users will never use this functionality, so we avoid having to deal with changes such as handling
 * renaming of variables and procedures (leaving it until the moment they are used, if ever).
 * @private
 */ 
Blockly.ViewBlock.lazyLoadOfOptions_ = function () {
  // Optimisation to avoid reloading all components and built-in objects unless it is needed.
  // needsReload.components is setup when adding/renaming/removing a component in components.js
  if (this.needsReload.components){
    Blockly.ViewBlock.generateOptions();
    this.needsReload.components = null;
  }
  this.reloadOptionsAfterChanges_();
}; 

/**
 * This function traverses all blocks in the workspace and re-creates all the options
 * available for type blocking. It's needed in the case of modifying the
 * Language tree after its creation (adding or renaming components, for instance).
 * It also loads all the built-in blocks.
 *
 * call 'reloadOptionsAfterChanges_' after calling this. The function lazyLoadOfOptions_ is an
 * example of how to call this function.
 */ 
Blockly.ViewBlock.generateOptions = function() {
  var buildListOfOptions = function() {
    var listOfOptions = {};
    var viewblockArray;
    var blocks = Blockly.mainWorkspace.getAllBlocks();

    // can we get names in a better way? 
    for (var i = 0; i < blocks.length; i++) {      
      block = blocks[i]; 
      var canonicName = ''; 
      var translatedName = ''; 

      if (block.category === 'Component' && block.setOrGet) {
        canonicName = block.type;
        translatedName = block.setOrGet + ' ' + block.instanceName + '.' + block.propertyName; 
      } else if (block.category === 'Component' && block.blockType === 'event') { 
        canonicName = block.type; 
        translatedName = "when " + block.instanceName + '.' + block.eventName; 
      } else if (block.category === 'Component' && block.methodName) { 
        canonicName = block.type; 
        translatedName = "call " + block.instanceName + '.' + block.methodName; 
      } else if ((block.category === 'Text' || block.category === 'Variables') && block.inputList[0].titleRow[0].text_) { 
        canonicName = block.type; 
        translatedName = block.inputList[0].titleRow[0].text_.toLowerCase();
      } else if (block.inputList[block.inputList.length-1].titleRow[0].text_) {
        canonicName = block.type; 
        translatedName = block.inputList[block.inputList.length-1].titleRow[0].text_.toLowerCase(); // don't know if lowercase is necessary 
      } else { 
         throw new Error('Unable to parse canonicName and translatedName');
      }

      if (canonicName !== '') { 
          listOfOptions[translatedName] = {
            canonicName: canonicName,
            dropDown: {},
            mutatorAttributes: {}
          };
      } 
    }
    return listOfOptions;
  };
  //This is called once on startup and then called on demand
  Blockly.ViewBlock.VBOptions_ = buildListOfOptions();
};


/**
 * This function reloads all the latest changes that might have occurred in the language tree or
 * the structures containing procedures and variables. It only needs to be called once even if
 * different sources are being updated at the same time (call on load proc, load vars, and generate
 * options, only needs one call of this function; and example of that is lazyLoadOfOptions_
 * @private
 */
Blockly.ViewBlock.reloadOptionsAfterChanges_ = function () {
  Blockly.ViewBlock.VBOptionsNames_ = goog.object.getKeys(Blockly.ViewBlock.VBOptions_);
  goog.array.sort(Blockly.ViewBlock.VBOptionsNames_);
  Blockly.ViewBlock.ac_.matcher_.setRows(Blockly.ViewBlock.VBOptionsNames_);
}; 

/**
 * Creates the auto-complete panel, powered by Google Closure's ac widget
 * @private
 */
Blockly.ViewBlock.createAutoComplete_ = function(inputText){
  Blockly.ViewBlock.VBOptionsNames_ = goog.object.getKeys( Blockly.ViewBlock.VBOptions_ );
  goog.array.sort(Blockly.ViewBlock.VBOptionsNames_);
  goog.events.unlistenByKey(Blockly.ViewBlock.currentListener_); //if there is a key, unlisten
  if (Blockly.ViewBlock.ac_)
    Blockly.ViewBlock.ac_.dispose(); //Make sure we only have 1 at a time

  // 3 objects needed to create a goog.ui.ac.AutoComplete instance
  var matcher = new Blockly.ViewBlock.ac.AIArrayMatcher(Blockly.ViewBlock.VBOptionsNames_, false);
  var renderer = new goog.ui.ac.Renderer();
  var inputHandler = new goog.ui.ac.InputHandler(null, null, false);

  Blockly.ViewBlock.ac_ = new goog.ui.ac.AutoComplete(matcher, renderer, inputHandler);
  Blockly.ViewBlock.ac_.setMaxMatches(100); //Renderer has a set height of 294px and a scroll bar.
  inputHandler.attachAutoComplete(Blockly.ViewBlock.ac_);
  inputHandler.attachInputs(goog.dom.getElement(inputText));

  Blockly.ViewBlock.currentListener_ = goog.events.listen(Blockly.ViewBlock.ac_,
      goog.ui.ac.AutoComplete.EventType.UPDATE,
    function() {
      // is there a better way to do this? can imagine this getting slow with many blocks 
      var blockName = goog.dom.getElement(inputText).value;
      var blocks = Blockly.mainWorkspace.getAllBlocks();
      Blockly.ViewBlock.VBMatches_ = []; 
      // var matches = []; 
      for (var i = 0; i < blocks.length; i++) {      
        block = blocks[i]; 
        if (block.category === 'Component' && block.setOrGet) {
          translatedName = block.setOrGet + ' ' + block.instanceName + '.' + block.propertyName; 
        } else if (block.category === 'Component' && block.blockType === 'event') { 
          translatedName = "when " + block.instanceName + '.' + block.eventName; 
        } else if (block.category === 'Component' && block.methodName) { 
          translatedName = "call " + block.instanceName + '.' + block.methodName; 
        } else if ((block.category === 'Text' || block.category === 'Variables') && block.inputList[0].titleRow[0].text_) { 
          translatedName = block.inputList[0].titleRow[0].text_.toLowerCase();
        } else if (block.inputList[block.inputList.length-1].titleRow[0].text_) {
          translatedName = block.inputList[block.inputList.length-1].titleRow[0].text_.toLowerCase(); // don't know if lowercase is necessary 
        } else { 
           throw new Error('Unable to parse translatedName');
        }

        // populate list of matches 
        if (blockName === translatedName) { 
          Blockly.ViewBlock.VBMatches_.push(block); 
          // console.log('Match made for: ' + blockName); 
        }
      }
      // focus the screen on the first match
      // do we want to select the block and highlight it? 
      if (Blockly.ViewBlock.VBMatches_.length > 0) { 
        goog.dom.getElement(Blockly.ViewBlock.matchesText_).innerHTML = Blockly.ViewBlock.VBMatches_.length.toString() + ' match(es) found.'; 
        var selectedBlock = Blockly.ViewBlock.VBMatches_[Blockly.ViewBlock.VBMatchesIdx_]; 
        var coords = selectedBlock.getRelativeToSurfaceXY(); 
        Blockly.mainWorkspace.scrollbar.set(coords.x, coords.y);
      } else {
        // console.log('No matches found for ' + blockName); 
      }
    }
  );
};

//--------------------------------------
// A custom matcher for the auto-complete widget that can handle numbers as well as the default
// functionality of goog.ui.ac.ArrayMatcher
goog.provide('Blockly.ViewBlock.ac.AIArrayMatcher');

goog.require('goog.iter');
goog.require('goog.string');

/**
 * Extension of goog.ui.ac.ArrayMatcher so that it can handle any number typed in.
 * @constructor
 * @param {Array} rows Dictionary of items to match.  Can be objects if they
 * have a toString method that returns the value to match against.
 * @param {boolean=} opt_noSimilar if true, do not do similarity matches for the
 * input token against the dictionary.
 * @extends {goog.ui.ac.ArrayMatcher}
 */
Blockly.ViewBlock.ac.AIArrayMatcher = function(rows, opt_noSimilar) {
  goog.ui.ac.ArrayMatcher.call(rows, opt_noSimilar);
  this.rows_ = rows;
  this.useSimilar_ = !opt_noSimilar;
};
goog.inherits(Blockly.ViewBlock.ac.AIArrayMatcher, goog.ui.ac.ArrayMatcher);


Blockly.ViewBlock.ac.AIArrayMatcher.prototype.requestMatchingRows = function(token, maxMatches,
    matchHandler, opt_fullString) {

  var matches = this.getPrefixMatches(token, maxMatches);

  //Because we allow for similar matches, Button.Text will always appear before Text
  //So we handle the 'text' case as a special case here
  if (token === 'text' || token === 'Text'){
    goog.array.remove(matches, 'Text');
    goog.array.insertAt(matches, 'Text', 0);
  }

  // Added code to handle any number typed in the widget (including negatives and decimals)
  var reg = new RegExp('^-?[0-9]\\d*(\.\\d+)?$', 'g');
  var match = reg.exec(token);
  if (match && match.length > 0){
    matches.push(token);
  }

  // Added code to handle default values for text fields (they start with " or ')
  var textReg = new RegExp('^[\"|\']+', 'g');
  var textMatch = textReg.exec(token);
  if (textMatch && textMatch.length === 1){
    matches.push(token);
  }

  if (matches.length === 0 && this.useSimilar_) {
    matches = this.getSimilarRows(token, maxMatches);
  }

  matchHandler(token, matches);
};
