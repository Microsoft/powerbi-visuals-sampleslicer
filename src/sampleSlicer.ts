/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

// "use strict";
import "../style/sampleSlicer.less";
import isEqual from "lodash.isequal";
import * as noUiSlider from "nouislider";

// d3
import {
    select as d3Select,
    selectAll as d3SelectAll,
    Selection as D3Selection,
    min as d3min,
    max as d3max
} from "d3";

type Selection<T> = D3Selection<any, T, any, any>;
//import UpdateSelection = d3.selection.Update;

// powerbi
import {
  IAdvancedFilter,
  IAdvancedFilterCondition,
  IFilterColumnTarget,
} from "powerbi-models";

// import FilterManager = powerbi.extensibility.utils.filter.FilterManager;
// import AppliedFilter = powerbi.extensibility.utils.filter.AppliedFilter;

import powerbiVisualsApi from "powerbi-visuals-api";
import DataView = powerbiVisualsApi.DataView;
import IViewport = powerbiVisualsApi.IViewport;
import ValueRange = powerbiVisualsApi.ValueRange;

import DataViewCategoryColumn = powerbiVisualsApi.DataViewCategoryColumn;
import DataViewCategoricalColumn = powerbiVisualsApi.DataViewCategoricalColumn;

import VisualObjectInstanceEnumeration = powerbiVisualsApi.VisualObjectInstanceEnumeration;
import EnumerateVisualObjectInstancesOptions = powerbiVisualsApi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstancesToPersist = powerbiVisualsApi.VisualObjectInstancesToPersist;

//TMP 2.5 import DataViewScopeIdentity = powerbiVisualsApi.DataViewScopeIdentity;
import DataViewObjectPropertyIdentifier = powerbiVisualsApi.DataViewObjectPropertyIdentifier;

// import IVisualEventService = powerbiVisualsApi.extensibility.IVisualEventService;

import IVisual = powerbiVisualsApi.extensibility.visual.IVisual; // powerbiVisualsApi.extensibility.IVisual;
import IVisualHost = powerbiVisualsApi.extensibility.visual.IVisualHost;
import VisualUpdateOptions = powerbiVisualsApi.extensibility.visual.VisualUpdateOptions;
import VisualConstructorOptions = powerbiVisualsApi.extensibility.visual.VisualConstructorOptions;
//TMP 2.5 import DataRepetitionSelector = powerbiVisualsApi.data.DataRepetitionSelector

import ISelectionId = powerbiVisualsApi.visuals.ISelectionId;

// powerbi.extensibility.utils.dataview
import { dataViewObjects as DataViewObjectsModule } from "powerbi-visuals-utils-dataviewutils";
// powerbi-visuals-utils-typeutils
import { pixelConverter as PixelConverter } from "powerbi-visuals-utils-typeutils";

// powerbi-visuals-utils-interactivityutils
import {
  interactivityBaseService,
  interactivitySelectionService,
} from "powerbi-visuals-utils-interactivityutils";

import createInteractivityService = interactivitySelectionService.createInteractivitySelectionService;
import IInteractivityService = interactivityBaseService.IInteractivityService;
import SelectableDataPoint = interactivitySelectionService.SelectableDataPoint;

// powerbi-visuals-utils-svgutils
import * as SVGUtil from "powerbi-visuals-utils-svgutils";
import IMargin = SVGUtil.IMargin;
import ClassAndSelector = SVGUtil.CssConstants.ClassAndSelector;
import createClassAndSelector = SVGUtil.CssConstants.createClassAndSelector;

// powerbi-visuals-utils-formattingutils
import { valueFormatter as valueFormatter, textMeasurementService as tms } from "powerbi-visuals-utils-formattingutils";
import IValueFormatter = valueFormatter.IValueFormatter;
import TextProperties = tms.TextProperties;
import textMeasurementService = tms.textMeasurementService;

import { Settings, defaultSettings, persistedSettingsDataViewObjectPropertyIdentifiers } from "./settings";
import { ScalableRange } from "./scalableRange";
import { ITableView, TableViewViewOptions,  TableViewFactory } from "./tableView";
import { SelectionBehavior, SampleSlicerBehaviorOptions } from "./selectionBehavior";
import { SampleSlicerConverter } from "./converter";

export const enum RangeValueType {
    Start,
    End
}

export interface SampleSlicerData {
    categorySourceName: string;
    formatString: string;
    slicerDataPoints: SampleSlicerDataPoint[];
    slicerSettings: Settings;
}

export interface SampleSlicerDataPoint extends SelectableDataPoint {
    category?: string;
    isSelectedRangePoint?: boolean;
    filtered?: boolean;
}

export interface SampleSlicerCallbacks {
    getPersistedSelectionState?: () => ISelectionId[];
    restorePersistedRangeSelectionState?: () => void;
    applyAdvancedFilter?: (filter: IAdvancedFilter) => void;
    getAdvancedFilterColumnTarget?: () => IFilterColumnTarget;
}

export class SampleSlicer implements IVisual {

    private root: HTMLElement; 
    private searchHeader: HTMLElement; 
    
    private searchInput: HTMLElement; 
    private currentViewport: IViewport;
    private dataView: DataView;
    private slicerHeader: Selection<any>;


    private rangeSlicer: Selection<any>;
    private rangeSlicerHead: Selection<any>;
    private rangeSlicerControls: Selection<any>;
    private rangeSlicerSlider: Selection<any>;
    private startControl: Selection<any>;
    private endControl: Selection<any>;


    private slicerBody: Selection<any>;
    private rangeBody: Selection<any>;
    private startContainer: Selection<any>;
    private endContainer: Selection<any>;
    
    private start: any;
    private end: any;
    
    private sliderElement: any;
    private slider: noUiSlider.noUiSlider;

    private tableView: ITableView;
    private slicerData: SampleSlicerData;

    private interactivityService: IInteractivityService<any>;
    // private eventService: IVisualEventService;

    private visualHost: IVisualHost;

    private waitingForData: boolean;
    private isSelectionLoaded: boolean;
    private isSelectionSaved: boolean;

    private behavior: SelectionBehavior;
    private settings: Settings;

    public static DefaultFontFamily: string = "helvetica, arial, sans-serif";
    public static DefaultFontSizeInPt: number = 11;
    private static СellTotalInnerBorders: number = 2;
    private static СhicletTotalInnerRightLeftPaddings: number = 14;
    private static MinSizeOfViewport: number = 0;
    private static MinColumns: number = 1;
    private static WidthOfScrollbar: number = 17;

    public static ItemContainerSelector: ClassAndSelector = createClassAndSelector('slicerItemContainer');
    public static SlicerImgWrapperSelector: ClassAndSelector = createClassAndSelector('slicer-img-wrapper');
    public static SlicerTextWrapperSelector: ClassAndSelector = createClassAndSelector('slicer-text-wrapper');
    public static SlicerBodyHorizontalSelector: ClassAndSelector = createClassAndSelector('slicerBody-horizontal');
    public static SlicerBodyVerticalSelector: ClassAndSelector = createClassAndSelector('slicerBody-vertical');
    public static HeaderTextSelector: ClassAndSelector = createClassAndSelector('headerText');
    public static ContainerSelector: ClassAndSelector = createClassAndSelector('sampleSlicer');
    public static LabelTextSelector: ClassAndSelector = createClassAndSelector('slicerText');
    public static HeaderSelector: ClassAndSelector = createClassAndSelector('slicerHeader');
    public static InputSelector: ClassAndSelector = createClassAndSelector('slicerCheckbox');
    public static ClearSelector: ClassAndSelector = createClassAndSelector('clear');
    public static BodySelector: ClassAndSelector = createClassAndSelector('slicerBody');
    public static RangeSlicerSelector: ClassAndSelector = createClassAndSelector('numeric-range-slicer');
    public static RangeSlicerHeadSelector: ClassAndSelector = createClassAndSelector('numeric-range-slicer-head');
    public static RangeSlicerControlsSelector: ClassAndSelector = createClassAndSelector('numeric-range-slicer-range');
    public static RangeSlicerSliderSelector: ClassAndSelector = createClassAndSelector('numeric-range-slicer-slider');
    public static RangeSlicerControlSelector: ClassAndSelector = createClassAndSelector('numeric-range-slicer-control');
    public static InputClass: ClassAndSelector = createClassAndSelector('numeric-range-slicer-input');

    public static converter(
        dataView: DataView,
        searchText: string,
        scalableRange: ScalableRange,
        visualHost: IVisualHost): SampleSlicerData {
        
          console.warn('TMP converters');
        if (window.location !== window.parent.location) {
          require("core-js/stable");
        }

        if (!dataView ||
            !dataView.categorical ||
            !dataView.categorical.categories ||
            !dataView.categorical.categories[0] ||
            !dataView.categorical.categories[0].values ||
            !(dataView.categorical.categories[0].values.length > 0)) {
            return;
        }

        let converter: SampleSlicerConverter = new SampleSlicerConverter(dataView, visualHost);
        converter.convert(scalableRange);

        let slicerSettings: Settings = defaultSettings;
        if (dataView.metadata.objects) {
            slicerSettings.general.selection = DataViewObjectsModule.getValue(dataView.metadata.objects, persistedSettingsDataViewObjectPropertyIdentifiers.general.selection, defaultSettings.general.selection);
            slicerSettings.general.rangeSelectionStart = DataViewObjectsModule.getValue(dataView.metadata.objects, persistedSettingsDataViewObjectPropertyIdentifiers.general.rangeSelectionStart, defaultSettings.general.selection);
            slicerSettings.general.rangeSelectionEnd = DataViewObjectsModule.getValue(dataView.metadata.objects, persistedSettingsDataViewObjectPropertyIdentifiers.general.rangeSelectionEnd, defaultSettings.general.selection);
            slicerSettings.general.filter = DataViewObjectsModule.getValue(dataView.metadata.objects, persistedSettingsDataViewObjectPropertyIdentifiers.general.filter, defaultSettings.general.filter);
        }

        if (searchText) {
            searchText = searchText.toLowerCase();
            converter.dataPoints.forEach(x => x.filtered = x.category.toLowerCase().indexOf(searchText) !== 0);
        }

        let categories: DataViewCategoricalColumn = dataView.categorical.categories[0];

        let slicerData: SampleSlicerData;
        slicerData = {
            categorySourceName: categories.source.displayName,
            formatString: valueFormatter.getFormatStringByColumn(categories.source),
            slicerSettings: slicerSettings,
            slicerDataPoints: converter.dataPoints
        };

        return slicerData;
    }


    //===============================================================================================================================
    //===============================================================================================================================

    constructor(options: VisualConstructorOptions) {
        this.root = options.element;

        this.visualHost = options.host;
        this.behavior = new SelectionBehavior(this.getCallbacks());
        this.interactivityService = createInteractivityService(options.host);

        this.settings = defaultSettings;
        // this.eventService = options.host.eventService; 
    }

    //===============================================================================================================================
    //===============================================================================================================================

    public update(options: VisualUpdateOptions) {
        if (!options ||
            !options.dataViews ||
            !options.dataViews[0] ||
            !options.viewport) {
            return;
        }
        
        // this.eventService.renderingStarted(options);
        console.log('update options.viewport', options.viewport, '\n this.currentViewport', this.currentViewport );

        // create viewport if not yet created
        if (!this.currentViewport) {
          this.currentViewport = options.viewport;
          this.initContainer();
        }
        
        // update dataview
        const existingDataView = this.dataView;
        this.dataView = options.dataViews[0];
        console.warn("UPDATE, this.dataView", this.dataView, '\n existingDataView', existingDataView);

        // check if the dataView changed to determine if scrollbars need to be reset
        let resetScrollbarPosition: boolean = true;
        if (existingDataView) {
          resetScrollbarPosition = !SampleSlicer.hasSameCategoryIdentity(existingDataView, this.dataView);
        }
        
        console.log(
          'SampleSlicer.hasSameCategoryIdentity(existingDataView, this.dataView)', 
          SampleSlicer.hasSameCategoryIdentity(existingDataView, this.dataView)
        );

        // update viewport
        if (options.viewport.height === this.currentViewport.height
            && options.viewport.width === this.currentViewport.width) {
            console.log('UPD viewport 1');
            this.waitingForData = false;
        }
        else {
            console.log('UPD viewport 2');
            this.currentViewport = options.viewport;
        }
        console.log('update calls updateInternal: \n resetScrollbarPosition', resetScrollbarPosition)
        this.updateInternal(resetScrollbarPosition);
        // this.eventService.renderingFinished(options);
    }

    private static hasSameCategoryIdentity(dataView1: DataView, dataView2: DataView): boolean {
        if (!dataView1 ||
            !dataView2 ||
            !dataView1.categorical ||
            !dataView2.categorical) {
            return false;
        }

        let dv1Categories: DataViewCategoricalColumn[] = dataView1.categorical.categories;
        let dv2Categories: DataViewCategoricalColumn[] = dataView2.categorical.categories;

        if (!dv1Categories ||
            !dv2Categories ||
            dv1Categories.length !== dv2Categories.length) {
            return false;
        }

        for (let i: number = 0, len: number = dv1Categories.length; i < len; i++) {
            let dv1Identity: any[] = (<DataViewCategoryColumn>dv1Categories[i]).identity; // TMP : DataViewScopeIdentity[
            let dv2Identity: any[] = (<DataViewCategoryColumn>dv2Categories[i]).identity; // TMP : DataViewScopeIdentity[

            let dv1Length: number = this.getLengthOptional(dv1Identity);
            if ((dv1Length < 1) || dv1Length !== this.getLengthOptional(dv2Identity)) {
                return false;
            }

            for (let j: number = 0; j < dv1Length; j++) {
                if (!isEqual(dv1Identity[j].key, dv2Identity[j].key)) {
                    return false;
                }
            }
        }

        return true;
    }

    private static getLengthOptional(identity: any[]): number { // TMP DataViewScopeIdentity == DataRepetitionSelector ? // TMP : DataViewScopeIdentity[
        if (identity) {
            return identity.length;
        }
        return 0;
    }

    
    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
        return [];
    }

    private restoreFilter(data: SampleSlicerData) {
        console.log('> restoreFilter data', data);
        // TODO
        console.warn('TODO restoreFilter');
    }

    private updateInternal(resetScrollbarPosition: boolean) {
        // convert data to internal representation
        let data = SampleSlicer.converter(
            this.dataView,
            (<HTMLInputElement>this.searchInput).value, // TMP JQUERY this.$searchInput.val()
            this.behavior.scalableRange,
            this.visualHost);
        
        console.log('> updateInternal! \n data:', data);

        if (!data) {
            this.tableView.empty();

            return;
        }

        this.restoreFilter(data);
        
        console.log(': this.slicerData', this.slicerData,
          '\n selectionSaved ?', this.isSelectionSaved,
          '\n selectionLoaded ?', this.isSelectionLoaded );

        if (this.slicerData) {
            if (this.isSelectionSaved) {
                this.isSelectionLoaded = true;
            } else {
                this.isSelectionLoaded = this.slicerData.slicerSettings.general.selection === data.slicerSettings.general.selection;
            }
        } else {
            this.isSelectionLoaded = false;
        }

        this.slicerData = data;
        this.settings = this.slicerData.slicerSettings;

        let height: number = this.settings.slicerText.height;

        this.slicerBody
          .style('height', `${this.currentViewport.height - 120}px`);

        console.log('this.tableView', this.tableView);

        // update tableView and render it
        this.tableView
            .rowHeight(height)
            .columnWidth(this.settings.slicerText.width)
            .rows(this.settings.general.rows)
            .columns(this.settings.general.columns)
            .data(
            data.slicerDataPoints.filter(x => !x.filtered),
            (d: SampleSlicerDataPoint) => data.slicerDataPoints.indexOf(d), // TMP JQUERY $.inArray(d, data.slicerDataPoints)
            resetScrollbarPosition)
            .viewport(this.getSlicerBodyViewport(this.currentViewport))
            .render();
        
        console.log('this.tableView', this.tableView);

        console.log('updateInternal > this.updateSliderControl');
        this.updateSliderControl();

        console.log('updateInternal > this.updateSliderInputTextboxes');
        this.updateSliderInputTextboxes();
    }

    public createInputElement(control: HTMLElement): HTMLElement {
      control.appendChild(
        SampleSlicer.createElement(`<input type="text" class="${SampleSlicer.InputClass.className}"/>`)
      );
      return control.querySelector("input");
    }

    private initContainer() {
        let settings: Settings = this.settings,
            slicerBodyViewport: IViewport = this.getSlicerBodyViewport(this.currentViewport);
        
        console.log('initContainer. Settings: ', settings, '\n slicerBodyViewport', slicerBodyViewport);
        
        // Prevents visual container from doing any other actions on keypress
        this.root.addEventListener("keyup", (event: KeyboardEvent) => {
          event.stopPropagation()
        });
        
        this.root.addEventListener("keydown", (event: KeyboardEvent) =>{
          event.stopPropagation()
        });

        this.rangeSlicer = d3Select(this.root)
            .append('div')
            .classed(SampleSlicer.RangeSlicerSelector.className, true)
            .style('background', '#ffffff');

        this.slicerHeader = this.rangeSlicer
            .append('div')
            .classed(SampleSlicer.HeaderSelector.className, true);

        this.rangeSlicerHead = this.rangeSlicer
            .append('div')
            .classed(SampleSlicer.RangeSlicerHeadSelector.className, true);
            
        this.rangeSlicerControls = this.rangeSlicerHead
            .append('div')
            .classed(SampleSlicer.RangeSlicerControlsSelector.className, true);

        this.rangeSlicerSlider = this.rangeSlicerHead
            .append('div')
            .classed(SampleSlicer.RangeSlicerSliderSelector.className, true);

        this.startControl = this.rangeSlicerControls
            .append('div')
            .classed(SampleSlicer.RangeSlicerControlSelector.className, true);

        this.endControl = this.rangeSlicerControls
            .append('div')
            .classed(SampleSlicer.RangeSlicerControlSelector.className, true);

        let startControl = this.startControl.nodes()[0]; 
        let endControl  = this.endControl.nodes()[0]; 
        
        this.start = this.createInputElement(startControl);
        this.end = this.createInputElement(endControl);

        let slicerContainer: Selection<any> = d3Select(this.root)
            .append('div')
            .classed(SampleSlicer.ContainerSelector.className, true)
            .style('background', '#ffffff');

        this.slicerHeader
            .append('div')
            .classed(SampleSlicer.HeaderTextSelector.className, true)
            .style('margin-left', PixelConverter.toString(settings.headerText.marginLeft))
            .style('margin-top', PixelConverter.toString(settings.headerText.marginTop))

        this.createSearchHeader(slicerContainer.node());  // TMP JQUERY TEST $(slicerContainer.node()) OK

        // SLICER BODY & TABLE VIEW
        this.slicerBody = slicerContainer
            .append('div')
            .classed(SampleSlicer.BodySelector.className, true)
            .style('height', `${slicerBodyViewport.height - 120}px`);

        let rowEnter = (rowSelection: Selection<any>) => {
            this.enterSelection(rowSelection);
        };

        let rowUpdate = (rowSelection: Selection<any>) => {
            this.updateSelection(rowSelection);
        };

        let rowExit = (rowSelection: Selection<any>) => {
            rowSelection.remove();
        };

        let tableViewOptions: TableViewViewOptions = {
            rowHeight: this.getRowHeight(),
            columnWidth: this.settings.slicerText.width,
            rows: this.settings.general.rows,
            columns: this.settings.general.columns,
            enter: rowEnter,
            exit: rowExit,
            update: rowUpdate,
            scrollEnabled: true,
            viewport: this.getSlicerBodyViewport(this.currentViewport),
            baseContainer: this.slicerBody,
        };
        
        this.bindHandlersToInputElements();
        console.log('initContainer >/ bindHandlers ')
        console.log('initContainer > TableViewFactory.createTableView(tableViewOptions) ', tableViewOptions);
        this.tableView = TableViewFactory.createTableView(tableViewOptions);
        console.log('initContainer >/ TableViewFactory.createTableView');
    }

    private bindHandlersToInputElements(): void {

        this.start.addEventListener("change", (event: Event) => {
            const inputString: string = this.start.value;
            this.onRangeInputTextboxChange(inputString, RangeValueType.Start);
        });

        this.start.addEventListener("keyup", (event: KeyboardEvent) => {
            if (event.keyCode === 13) {
                const inputString: string = this.start.value;
                this.onRangeInputTextboxChange(inputString, RangeValueType.Start);
            }
        });

        this.start.addEventListener("focus", (event: Event) => {
            this.start.value = this.formatValue(this.behavior.scalableRange.getValue().min);
            this.start.select(); 
        });

        this.end.addEventListener("change", (event: Event) => {
            const inputString: string = this.end.value;
            this.onRangeInputTextboxChange(inputString, RangeValueType.End);
        });

        this.end.addEventListener("keyup", (event: KeyboardEvent) => {
            if (event.keyCode === 13) {
                const inputString: string = this.start.end;
                this.onRangeInputTextboxChange(inputString, RangeValueType.End);
            }
        });

        this.end.addEventListener("focus", (event: Event) => {
            this.end.value = this.formatValue(this.behavior.scalableRange.getValue().max);
            this.end.select(); 
        });
    }

    private createSliderOptions(): noUiSlider.Options {
        let value = this.behavior.scalableRange.getScaledValue();

        const options: noUiSlider.Options = {
            connect: true,
            behaviour: "tap-drag",
            range: {
                min: 0,
                max: 100
            },
            start: [value.min, value.max]
        };

        return options;
    }

    private updateSliderControl(): void {
        let sliderContainer: HTMLElement = this.rangeSlicerSlider.nodes()[0];
        console.warn('> updateSliderControl');

        if (!this.slider) {
            // create slider
            console.warn("Create slider");

            this.sliderElement = sliderContainer.appendChild(
                SampleSlicer.createElement('<div />')
            );

            noUiSlider.create(this.sliderElement, this.createSliderOptions());

            this.slider = (<noUiSlider.Instance>this.sliderElement).noUiSlider;

            // populate slider event handlers
            this.slider.on("change", (data: any[], index: number, values: any) => {
                this.behavior.scalableRange.setScaledValue({ min: values[0], max: values[1] });
                this.behavior.updateOnRangeSelectonChange();
                this.updateInternal(false);
            });

        } else {
            // get the scaled range value
            // and use it to set the slider
            let scaledValue = this.behavior.scalableRange.getScaledValue();
            this.slider.set([scaledValue.min, scaledValue.max]);
        }
    }

    public updateSliderInputTextboxes(): void {
        console.warn('> updateSliderInputTextboxes', this.behavior.scalableRange.getValue(), 
          this.formatValue(this.behavior.scalableRange.getValue().min), 
          this.formatValue(this.behavior.scalableRange.getValue().max)
        );
        this.start.value = this.behavior.scalableRange.getValue().min; //this.formatValue(this.behavior.scalableRange.getValue().min);
        this.end.value = this.behavior.scalableRange.getValue().max; //this.formatValue(this.behavior.scalableRange.getValue().max);
    }

    public formatValue(value: number): string {
        return value != null ? valueFormatter.format(value, "#") : '';
    }

    private onRangeInputTextboxChange(
        inputString: string, 
        rangeValueType: RangeValueType, 
        supressFilter: boolean = false
    ): void {
        console.warn('!> onRangeInputTextboxChange: \n inputString', inputString, 
          '\n rangeValueType', rangeValueType, 
          '\n supressFilter', supressFilter
        );
        // parse input
        let inputValue: number;
        if (!inputString) {
            inputValue = null;
        } else {
            inputValue = parseFloat(inputString);
            if (isNaN(inputValue)) {
                inputValue = null;
            }
        }

        // update range selection model if changed
        let range: ValueRange<number> = this.behavior.scalableRange.getValue();
        if (rangeValueType === RangeValueType.Start) {
            if (range.min === inputValue) {
                return;
            }
            range.min = inputValue;
        }
        else if (rangeValueType === RangeValueType.End) {
            if (range.max === inputValue) {
                return;
            }
            range.max = inputValue;
        }

        if (!supressFilter) {
            this.behavior.scalableRange.setValue(range);

            // trigger range change processing
            this.behavior.updateOnRangeSelectonChange();
            this.updateInternal(false);
        }
    }

    private enterSelection(rowSelection: Selection<any>): void {
        console.log('!> this.enterSelection: rowSelection', rowSelection);
        let settings: Settings = this.settings;

        let ulItemElement: Selection<any> = rowSelection // TMP UpdateSelection
            .selectAll('ul')
            .data((dataPoint: SampleSlicerDataPoint) => {
                return [dataPoint];
            });

        ulItemElement
            .enter()
            .append('ul');

        ulItemElement
            .exit()
            .remove();

        let listItemElement: Selection<any> = ulItemElement // TMP UpdateSelection
            .selectAll(SampleSlicer.ItemContainerSelector.selectorName)
            .data((dataPoint: SampleSlicerDataPoint) => {
                return [dataPoint];
            });

        listItemElement
            .enter()
            .append('li')
            .classed(SampleSlicer.ItemContainerSelector.className, true);

        listItemElement
            .style('margin-left', PixelConverter.toString(settings.slicerItemContainer.marginLeft));

        let slicerImgWrapperSelection: Selection<any> = listItemElement // TMP UpdateSelection
            .selectAll(SampleSlicer.SlicerImgWrapperSelector.className)
            .data((dataPoint: SampleSlicerDataPoint) => {
                return [dataPoint];
            });

        slicerImgWrapperSelection
            .enter()
            .append('img')
            .classed(SampleSlicer.SlicerImgWrapperSelector.className, true);

        slicerImgWrapperSelection
            .exit()
            .remove();

        let slicerTextWrapperSelection: Selection<any> = listItemElement // TMP UpdateSelection
            .selectAll(SampleSlicer.SlicerTextWrapperSelector.selectorName)
            .data((dataPoint: SampleSlicerDataPoint) => {
                return [dataPoint];
            });

        slicerTextWrapperSelection
            .enter()
            .append('div')
            .classed(SampleSlicer.SlicerTextWrapperSelector.className, true);

        let labelTextSelection: Selection<any> = slicerTextWrapperSelection // TMP UpdateSelection
            .selectAll(SampleSlicer.LabelTextSelector.selectorName)
            .data((dataPoint: SampleSlicerDataPoint) => {
                return [dataPoint];
            });

        labelTextSelection
            .enter()
            .append('span')
            .classed(SampleSlicer.LabelTextSelector.className, true);

        labelTextSelection
          .style('font-size', PixelConverter.fromPoint(settings.slicerText.textSize));

        labelTextSelection
            .exit()
            .remove();

        slicerTextWrapperSelection
            .exit()
            .remove();

        listItemElement
            .exit()
            .remove();
    }

    private updateSelection(rowSelection: Selection<any>): void {
        let settings: Settings = this.settings,
            data: SampleSlicerData = this.slicerData;
        
        console.log('!> updateSelection rowSelection', rowSelection, 
          '\n this.slicerData', this.slicerData,
          '\n this.settings', this.settings);

        if (data && settings) {

            this.slicerHeader
                .select(SampleSlicer.HeaderTextSelector.selectorName)
                .text(this.slicerData.categorySourceName);

            let slicerText: Selection<any> = rowSelection.selectAll(SampleSlicer.LabelTextSelector.selectorName),
                textProperties: TextProperties = SampleSlicer.getSampleTextProperties(settings.slicerText.textSize),
                formatString: string = data.formatString;

            slicerText.text((d: SampleSlicerDataPoint) => {
                let maxWidth: number = 0;

                textProperties.text = valueFormatter.format(d.category, formatString);

                if (this.settings.slicerText.width === 0) {
                    let slicerBodyViewport: IViewport = this.getSlicerBodyViewport(this.currentViewport);

                    maxWidth = (slicerBodyViewport.width / (this.tableView.computedColumns || SampleSlicer.MinColumns)) -
                        SampleSlicer.СhicletTotalInnerRightLeftPaddings -
                        SampleSlicer.СellTotalInnerBorders;
                    return textMeasurementService.getTailoredTextOrDefault(textProperties, maxWidth);
                }
                else {
                    maxWidth = this.settings.slicerText.width -
                        SampleSlicer.СhicletTotalInnerRightLeftPaddings -
                        SampleSlicer.СellTotalInnerBorders;

                    return textMeasurementService.getTailoredTextOrDefault(textProperties, maxWidth);
                }
            });

            rowSelection
                .style('padding', PixelConverter.toString(settings.slicerText.padding));

            rowSelection.selectAll(SampleSlicer.ItemContainerSelector.selectorName)
                .style('font-size', PixelConverter.fromPoint(settings.slicerText.textSize));

            if (this.interactivityService && this.slicerBody) {
                this.interactivityService.applySelectionStateToData(data.slicerDataPoints);

                let slicerBody: Selection<any> = this.slicerBody.attr('width', this.currentViewport.width),
                    slicerItemContainers: Selection<any> = slicerBody.selectAll(SampleSlicer.ItemContainerSelector.selectorName);

                let behaviorOptions: SampleSlicerBehaviorOptions = {
                    dataPoints: data.slicerDataPoints,
                    slicerItemContainers: slicerItemContainers,
                    interactivityService: this.interactivityService,
                    slicerSettings: data.slicerSettings,
                    isSelectionLoaded: this.isSelectionLoaded,
                    behavior:  this.behavior
                };

                this.interactivityService.bind(behaviorOptions); //data.slicerDataPoints, this.behavior, behaviorOptions, {      });

                this.behavior.styleSlicerInputs(
                    rowSelection.select(SampleSlicer.ItemContainerSelector.selectorName),
                    this.interactivityService.hasSelection());
            }
            else {
                this.behavior.styleSlicerInputs(rowSelection.select(SampleSlicer.ItemContainerSelector.selectorName), false);
            }
        }
    }

    private static createElement(htmlString: string): HTMLElement {
        const parser = new DOMParser();
        const html = parser.parseFromString(htmlString, 'text/html');
        return <HTMLElement>html.body.firstChild; 
    }

    private createSearchHeader(container: HTMLElement): void {
        let counter: number = 0;
        console.warn('TMP createSearchHeader ');
        
        this.searchHeader = SampleSlicer.createElement(`<div class="searchHeader show" />`);
        container.appendChild(this.searchHeader);

        this.searchHeader.appendChild(
          SampleSlicer.createElement(`<div class="search" title="Search" />`)
        );

        this.searchInput = SampleSlicer.createElement(`<input type="text" drag-resize-disabled class="searchInput"/>`);
        
        const searchEventlinstener = () => {
          this.visualHost.persistProperties(<VisualObjectInstancesToPersist>{
              merge: [{
                  objectName: "general",
                  selector: null,
                  properties: {
                      counter: counter++
                  }
              }]
          });
          this.updateInternal(false); 
        };

        this.searchInput.addEventListener(
            "input",
            searchEventlinstener
        );

        this.searchHeader.appendChild(this.searchInput);
    }

    private getSlicerBodyViewport(currentViewport: IViewport): IViewport {
        let settings: Settings = this.settings,
            height: number = currentViewport.height,
            width: number = currentViewport.width - SampleSlicer.WidthOfScrollbar;
        return {
            height: Math.max(height, SampleSlicer.MinSizeOfViewport),
            width: Math.max(width, SampleSlicer.MinSizeOfViewport)
        };
    }

    public static getSampleTextProperties(textSize?: number): TextProperties {
        return <TextProperties>{
            fontFamily: SampleSlicer.DefaultFontFamily,
            fontSize: PixelConverter.fromPoint(textSize || SampleSlicer.DefaultFontSizeInPt),
        };
    }

    private getRowHeight(): number {
        let textSettings = this.settings.slicerText;
        return textSettings.height !== 0
            ? textSettings.height
            : textMeasurementService.estimateSvgTextHeight(SampleSlicer.getSampleTextProperties(textSettings.textSize));
    }

    /**
     *  Callbacks consumed by the SelectionBehavior class
     * */
    private getCallbacks(): SampleSlicerCallbacks {
        let callbacks: SampleSlicerCallbacks = {};
        console.log('> getCallbacks');

        callbacks.applyAdvancedFilter = (filter: IAdvancedFilter): void => {
          //this.visualHost.applyJsonFilter(filter, "general", "filter", FilterAction.merge );  // TMP comment bc FilterAction
        };

        callbacks.getAdvancedFilterColumnTarget = (): IFilterColumnTarget => {
            let categories: DataViewCategoricalColumn = this.dataView.categorical.categories[0];

            let target: IFilterColumnTarget = {
                table: categories.source.queryName.substr(0, categories.source.queryName.indexOf('.')),
                column: categories.source.displayName
            };

            return target;
        };

        callbacks.getPersistedSelectionState = (): ISelectionId[] => {
            try {
                return JSON.parse(this.slicerData.slicerSettings.general.selection) || [];
            } catch (ex) {
                return [];
            }
        };
        
        console.log('> getCallbacks callbacks', callbacks);

        return callbacks;
    }
}