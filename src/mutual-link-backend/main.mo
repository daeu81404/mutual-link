import DoctorManagement "./DoctorManagement";
import ApprovalManagement "./ApprovalManagement";
import Result "mo:base/Result";
import Nat "mo:base/Nat";

actor {
  private let doctorManager = DoctorManagement.DoctorManager();
  private let approvalManager = ApprovalManagement.ApprovalManager();

  public shared(msg) func updateDoctor(doctor: DoctorManagement.Doctor) : async Result.Result<DoctorManagement.Doctor, Text> {
    doctorManager.updateDoctor(doctor)
  };

  public shared(msg) func deleteDoctor(id: Nat) : async Result.Result<(), Text> {
    doctorManager.deleteDoctor(id)
  };

  public query func getAllDoctors() : async [DoctorManagement.Doctor] {
    doctorManager.getAllDoctors()
  };

  public query func getDoctor(id: Nat) : async ?DoctorManagement.Doctor {
    doctorManager.getDoctor(id)
  };

  public shared(msg) func updateDoctorPublicKey(email: Text, publicKey: Text) : async Result.Result<DoctorManagement.Doctor, Text> {
    doctorManager.updateDoctorPublicKey(email, publicKey)
  };

  public query func getDoctorByEmail(email: Text) : async ?DoctorManagement.Doctor {
    doctorManager.getDoctorByEmail(email)
  };

  public shared(msg) func createApproval(approval: ApprovalManagement.Approval) : async Result.Result<ApprovalManagement.Approval, Text> {
    approvalManager.createApproval(approval)
  };

  public shared(msg) func updateApprovalStatus(id: Nat, status: Text) : async Result.Result<ApprovalManagement.Approval, Text> {
    approvalManager.updateApprovalStatus(id, status)
  };

  public query func getAllApprovals() : async [ApprovalManagement.Approval] {
    approvalManager.getAllApprovals()
  };

  public query func getApprovalsByDoctor(doctorName: Text, role: Text) : async [ApprovalManagement.Approval] {
    approvalManager.getApprovalsByDoctor(doctorName, role)
  };

  public query func getApproval(id: Nat) : async ?ApprovalManagement.Approval {
    approvalManager.getApproval(id)
  };
};
