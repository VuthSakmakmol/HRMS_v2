import mongoose from "mongoose"

const { Schema } = mongoose

const attendanceRecordSchema = new Schema(
    {
        employeeId: {
            type: Schema.Types.ObjectId,
            ref: "Employee",
            required: true,
        },
        employeeCode: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
        },
        attendanceDate: {
            type: Date,
            required: true,
        },
        companyId: {
            type: Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        branchId: {
            type: Schema.Types.ObjectId,
            ref: "Branch",
            required: true,
        },
        departmentId: {
            type: Schema.Types.ObjectId,
            ref: "Department",
            required: true,
        },
        positionId: {
            type: Schema.Types.ObjectId,
            ref: "Position",
            required: true,
        },
        lineId: {
            type: Schema.Types.ObjectId,
            ref: "Line",
            required: true,
        },
        shiftId: {
            type: Schema.Types.ObjectId,
            ref: "Shift",
            required: true,
        },
        firstInAt: {
            type: Date,
            default: null,
        },
        lastOutAt: {
            type: Date,
            default: null,
        },
        workedMinutes: {
            type: Number,
            min: 0,
            default: 0,
        },
        lateMinutes: {
            type: Number,
            min: 0,
            default: 0,
        },
        earlyLeaveMinutes: {
            type: Number,
            min: 0,
            default: 0,
        },
        status: {
            type: String,
            enum: [
                "PRESENT",
                "LATE",
                "EARLY_LEAVE",
                "LATE_AND_EARLY_LEAVE",
                "MISSING_IN",
                "MISSING_OUT",
                "ABSENT",
                "REST_DAY",
                "HOLIDAY",
            ],
            required: true,
            default: "ABSENT",
        },
        source: {
            type: String,
            enum: ["MANUAL", "EXCEL_IMPORT", "MACHINE_SYNC"],
            default: "MANUAL",
        },
        verificationStatus: {
            type: String,
            enum: ["VERIFIED", "NEEDS_REVIEW", "CORRECTED"],
            default: "VERIFIED",
        },
        note: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: "",
        },
        createdByAccountId: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            default: null,
        },
        updatedByAccountId: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            default: null,
        },
    },
    {
        collection: "attendance_records",
        timestamps: true,
        versionKey: false,
    },
)

attendanceRecordSchema.index(
    {
        employeeId: 1,
        attendanceDate: 1,
    },
    {
        unique: true,
        name: "uq_attendance_employee_date",
    },
)

attendanceRecordSchema.index(
    {
        attendanceDate: 1,
        companyId: 1,
        branchId: 1,
        departmentId: 1,
        positionId: 1,
        lineId: 1,
        status: 1,
    },
    {
        name: "idx_attendance_filters",
    },
)

attendanceRecordSchema.set("toJSON", {
    virtuals: true,
    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
    },
})

const AttendanceRecord =
    mongoose.models.AttendanceRecord ||
    mongoose.model("AttendanceRecord", attendanceRecordSchema)

export default AttendanceRecord
